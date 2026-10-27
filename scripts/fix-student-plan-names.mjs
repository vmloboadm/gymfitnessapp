#!/usr/bin/env node
/**
 * Corrige planos ativos que apontam para a ficha de outra aluna (caso Bruna).
 * Sem --apply só lista. Com --apply clona o programa por aluno e aposenta o
 * vínculo antigo, preservando dias, exercícios e slot_checks.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const apply = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const db = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 6543),
  user: env.SUPABASE_DB_USER || "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const rows = (await db.query(`
  select sw.id as student_workout_id, sw.gym_id, sw.student_id,
         p.name as student_name, wp.*
  from public.student_workouts sw
  join public.profiles p on p.id = sw.student_id
  join public.workout_programs wp on wp.id = sw.program_id
  where sw.status = 'active'
    and wp.name ilike '%bruna%'
    and p.name not ilike 'bruna%'
  order by p.name
`)).rows;

if (!rows.length) {
  console.log("Nada a corrigir: nenhum plano ativo de outra aluna com nome Bruna.");
  await db.end();
  process.exit(0);
}

console.log(`Planos afetados: ${rows.length}`);
for (const r of rows) {
  const days = (await db.query("select count(*)::int as n from public.workout_days where program_id = $1", [r.id])).rows[0].n;
  const exs = (await db.query(`
    select count(*)::int as n from public.workout_exercises we
    join public.workout_days wd on wd.id = we.day_id
    where wd.program_id = $1
  `, [r.id])).rows[0].n;
  console.log(`- ${r.student_name}: ${r.name} (${days} dias, ${exs} exercícios), student_workout ${r.student_workout_id}`);
}

if (!apply) {
  console.log("\nDry-run. Rode com --apply para clonar por aluna.");
  await db.end();
  process.exit(0);
}

function sanitizeDraft(raw, finalName, studentName) {
  if (!raw) return raw;
  try {
    const d = JSON.parse(raw);
    d.nome = finalName;
    if (typeof d.observacao_geral === "string") {
      d.observacao_geral = d.observacao_geral.replace(/Bruna(?:\s+Gomes)?/gi, studentName);
    }
    return JSON.stringify(d);
  } catch {
    return raw;
  }
}

for (const r of rows) {
  const firstName = String(r.student_name).split(/\s+/)[0];
  const finalName = `Treino de ${firstName}`;
  const draft = sanitizeDraft(r.ai_draft, finalName, r.student_name);
  await db.query("begin");
  try {
    const np = (await db.query(`
      insert into public.workout_programs
        (gym_id, trainer_id, name, objective, created_via, ai_model, ai_draft, reviewed_by)
      values ($1, $2, $3, $4, 'manual', $5, $6, $7)
      returning id
    `, [r.gym_id, r.trainer_id, finalName, r.objective, r.ai_model, draft, r.reviewed_by])).rows[0];
    const newProgramId = np.id;

    const days = (await db.query(
      "select id, name, day_order from public.workout_days where program_id = $1 order by day_order, id",
      [r.id]
    )).rows;
    for (const d of days) {
      const nd = (await db.query(
        "insert into public.workout_days (gym_id, program_id, name, day_order) values ($1,$2,$3,$4) returning id",
        [r.gym_id, newProgramId, d.name, d.day_order]
      )).rows[0];
      const exs = (await db.query(
        `select exercise_id, variation_id, sets, reps, rest_seconds, rpe, notes, technique, ord
         from public.workout_exercises where day_id = $1 order by ord, id`,
        [d.id]
      )).rows;
      for (const e of exs) {
        await db.query(
          `insert into public.workout_exercises
            (gym_id, day_id, exercise_id, variation_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [r.gym_id, nd.id, e.exercise_id, e.variation_id, e.sets, e.reps, e.rest_seconds, e.rpe, e.notes, e.technique, e.ord]
        );
      }
    }

    // Preserva a rotação já feita, agora ligada ao programa novo.
    await db.query(`
      insert into public.slot_checks (gym_id, student_id, program_id, slot, checked_at)
      select gym_id, student_id, $1, slot, checked_at
      from public.slot_checks
      where student_id = $2 and program_id = $3
    `, [newProgramId, r.student_id, r.id]);

    await db.query(
      "update public.student_workouts set status = 'completed', completed_at = now() where id = $1",
      [r.student_workout_id]
    );
    const nsw = (await db.query(`
      insert into public.student_workouts (gym_id, student_id, program_id, status, assigned_at)
      values ($1,$2,$3,'active',now()) returning id
    `, [r.gym_id, r.student_id, newProgramId])).rows[0];

    // Sessão ativa, se existir, passa a apontar para a cópia.
    await db.query(`
      update public.workout_sessions
      set workout_id = $1,
          meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{programId}', to_jsonb($2::text), true)
      where student_id = $3 and status = 'active'
        and (meta->>'programId' = $4::text or meta->>'programId' = $5::text or workout_id = $5::uuid)
    `, [nsw.id, newProgramId, r.student_id, r.id, r.student_workout_id]);

    await db.query("commit");
    console.log(`OK ${r.student_name}: ${finalName} (${newProgramId})`);
  } catch (err) {
    await db.query("rollback");
    console.error(`FALHOU ${r.student_name}: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  }
}

const left = (await db.query(`
  select count(*)::int as n from public.student_workouts sw
  join public.profiles p on p.id = sw.student_id
  join public.workout_programs wp on wp.id = sw.program_id
  where sw.status = 'active' and wp.name ilike '%bruna%' and p.name not ilike 'bruna%'
`)).rows[0].n;
console.log(`Restantes com nome Bruna em outra aluna: ${left}`);
await db.end();
