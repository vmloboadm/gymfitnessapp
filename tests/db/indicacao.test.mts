import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Indique um amigo (migration 083): cada aluno tem um código; o amigo que
 * se cadastra com o código vira indicação; o desconto (R$ 20) só conta
 * quando o amigo é aprovado. Código de outra academia não vale.
 */

/** A academia "padrão" é a primeira criada (é ela que o cadastro usa). */
async function defaultGym(q: Q): Promise<string> {
  const [g] = await q<{ id: string }>("select id from gyms order by created_at limit 1");
  if (g) return g.id;
  const id = "00000000-0000-0000-0000-000000000001";
  await q("insert into gyms (id, name, slug) values ($1, 'Academia Padrão', 'padrao-teste')", [id]);
  return id;
}

async function indicador(q: Q, h: Helpers, gym: string, code: string): Promise<string> {
  const id = await h.student(gym, "Ana Indica");
  await q("update profiles set referral_code = $2 where id = $1", [id, code]);
  return id;
}

/**
 * O dump de schema da base de teste não traz a trigger do Supabase Auth em
 * auth.users. Criamos aqui dentro da transação (some no rollback) para testar
 * o cadastro de verdade.
 */
async function cadastrar(q: Q, ref: string | null): Promise<string> {
  await defaultGym(q);
  await q("drop trigger if exists on_auth_user_created on auth.users");
  await q("create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()");
  const id = randomUUID();
  const meta = JSON.stringify(ref ? { name: "Amigo Novo", ref } : { name: "Amigo Novo" });
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [id, `${id}@teste.local`, meta]);
  return id;
}

test("cadastro com o código cria a indicação para quem indicou (sem diferenciar maiúscula)", async () => {
  await withTx(async (q, h) => {
    const gym = await defaultGym(q);
    const ana = await indicador(q, h, gym, "ABC123");
    const novo = await cadastrar(q, "abc123");
    const rows = await q<{ referrer_id: string; amount_cents: number }>(
      "select referrer_id, amount_cents from referrals where referred_id = $1", [novo]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].referrer_id, ana);
    assert.equal(rows[0].amount_cents, 2000);
  });
});

test("cadastro sem código ou com código inexistente não cria indicação", async () => {
  await withTx(async (q) => {
    const sem = await cadastrar(q, null);
    const errado = await cadastrar(q, "NAOEXISTE");
    const [n] = await q<{ n: number }>("select count(*)::int n from referrals where referred_id in ($1, $2)", [sem, errado]);
    assert.equal(n.n, 0);
  });
});

test("código de outra academia não vale", async () => {
  await withTx(async (q, h) => {
    await defaultGym(q);
    const outra = await h.gym();
    await indicador(q, h, outra, "OUTRA1");
    const novo = await cadastrar(q, "OUTRA1");
    const [n] = await q<{ n: number }>("select count(*)::int n from referrals where referred_id = $1", [novo]);
    assert.equal(n.n, 0);
  });
});

test("todo aluno nasce com código de indicação", async () => {
  await withTx(async (q) => {
    const novo = await cadastrar(q, null);
    const [p] = await q<{ referral_code: string | null }>("select referral_code from profiles where id = $1", [novo]);
    assert.match(p.referral_code ?? "", /^[A-Z0-9]{6}$/);
  });
});

test("desconto só conta depois que o amigo é aprovado", async () => {
  await withTx(async (q, h) => {
    const gym = await defaultGym(q);
    const ana = await indicador(q, h, gym, "ANA001");
    const novo = await cadastrar(q, "ANA001");

    await h.asApp(ana);
    const [antes] = await q<{ r: { total: number; approved: number; credit_cents: number; code: string } }>("select public.my_referral() r");
    await h.asDb();
    assert.equal(antes.r.total, 1);
    assert.equal(antes.r.approved, 0);
    assert.equal(antes.r.credit_cents, 0);
    assert.equal(antes.r.code, "ANA001");

    await q("update profiles set approved_at = now() where id = $1", [novo]);
    await h.asApp(ana);
    const [depois] = await q<{ r: { approved: number; credit_cents: number } }>("select public.my_referral() r");
    await h.asDb();
    assert.equal(depois.r.approved, 1);
    assert.equal(depois.r.credit_cents, 2000);
  });
});

test("indicações não têm limite: 3 amigos aprovados somam R$ 60", async () => {
  await withTx(async (q, h) => {
    const gym = await defaultGym(q);
    const ana = await indicador(q, h, gym, "ANA002");
    for (let i = 0; i < 3; i++) {
      const novo = await cadastrar(q, "ANA002");
      await q("update profiles set approved_at = now() where id = $1", [novo]);
    }
    await h.asApp(ana);
    const [r] = await q<{ r: { approved: number; credit_cents: number } }>("select public.my_referral() r");
    await h.asDb();
    assert.equal(r.r.approved, 3);
    assert.equal(r.r.credit_cents, 6000);
  });
});

test("aluno não enxerga indicações de outra pessoa", async () => {
  await withTx(async (q, h) => {
    const gym = await defaultGym(q);
    const ana = await indicador(q, h, gym, "ANA003");
    const bia = await h.student(gym, "Bia Outra");
    await cadastrar(q, "ANA003");
    await h.asApp(bia);
    const rows = await q<{ id: string }>("select id from referrals");
    await h.asDb();
    assert.equal(rows.length, 0, "Bia não é indicadora nem indicada");
    assert.ok(ana);
  });
});
