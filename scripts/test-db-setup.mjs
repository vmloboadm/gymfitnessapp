/**
 * Prepara o banco dos testes de SQL (tests/db):
 *   1. sobe um Postgres 17 no Docker (container gf-testdb, porta 54329) se
 *      TEST_DATABASE_URL não foi passado;
 *   2. recria o banco gf_test do zero;
 *   3. carrega a imitação do Supabase, o esquema de produção e o catálogo
 *      de conquistas (supabase/test/*.sql). Nenhum dado de aluno;
 *   4. aplica por cima as migrations MAIS NOVAS que a cópia do esquema
 *      (supabase/test/SNAPSHOT_MIGRATION): assim uma migration nova é
 *      testada aqui antes de ir para produção.
 *
 * Atualizar o esquema depois de uma migration nova: npm run test:db:snapshot
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const CONTAINER = "gf-testdb";
const PORT = 54329;
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? `postgres://postgres:test@127.0.0.1:${PORT}/postgres`;
const DB = "gf_test";

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

function ensureContainer() {
  if (process.env.TEST_DATABASE_ADMIN_URL) return;
  let state = "";
  try {
    state = sh("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER]);
  } catch {
    state = "missing";
  }
  if (state === "missing") {
    console.log("› subindo Postgres de teste no Docker…");
    sh("docker", [
      "run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=test",
      "-p", `127.0.0.1:${PORT}:5432`, "postgres:17-alpine",
    ]);
  } else if (state !== "true") {
    sh("docker", ["start", CONTAINER]);
  }
}

async function connectWithRetry(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      return c;
    } catch {
      await c.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Postgres de teste não respondeu em ${url}`);
}

const file = (name) => readFileSync(new URL(`../supabase/test/${name}`, import.meta.url), "utf8");

ensureContainer();
const admin = await connectWithRetry(ADMIN_URL);
await admin.query(`drop database if exists ${DB} with (force)`);
await admin.query(`create database ${DB}`);
await admin.end();

const url = new URL(ADMIN_URL);
url.pathname = `/${DB}`;
const db = await connectWithRetry(url.toString());
for (const f of ["supabase-stubs.sql", "schema.sql", "seed-achievements.sql", "seed-exercises.sql"]) {
  try {
    await db.query(file(f));
  } catch (err) {
    console.error(`✗ falha ao carregar supabase/test/${f}: ${err.message}`);
    process.exit(1);
  }
}
// Supabase dá acesso às tabelas para anon/authenticated e deixa o RLS
// decidir; o dump sai sem esses grants, então recriamos aqui.
await db.query(`
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant execute on all functions in schema public to anon, authenticated, service_role;
  -- tabelas só do servidor (RLS ligada e nenhuma policy) continuam fechadas,
  -- como em produção (app_errors, app_config, whatsapp_outbox…)
  do $$
  declare t record;
  begin
    for t in
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    loop
      execute format('revoke all on public.%I from anon, authenticated', t.relname);
    end loop;
  end $$;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

await db.query(file("revoked-functions.sql"));

const snapshot = file("SNAPSHOT_MIGRATION").trim();
const pending = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .filter((f) => /^\d{3}_.*\.sql$/.test(f) && f.slice(0, 3) > snapshot)
  .sort();
for (const f of pending) {
  try {
    await db.query(readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"));
    console.log(`› migration nova aplicada no teste: ${f}`);
  } catch (err) {
    console.error(`✗ migration ${f} falhou no banco de teste: ${err.message}`);
    process.exit(1);
  }
}
await db.end();
console.log(`✓ banco de teste pronto (${url.host}/${DB})`);
