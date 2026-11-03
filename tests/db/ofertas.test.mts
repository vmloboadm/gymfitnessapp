import test from "node:test";
import assert from "node:assert/strict";
import { withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Vitrine do personal (migration 076): o personal cadastra planos de
 * acompanhamento; o aluno vê os planos ativos da academia dele e pede um
 * plano específico, que fica registrado e avisa só aquele personal.
 */

type Offer = { id: string; title: string; price_cents: number | null; sessions_per_week: number | null; duration_label: string | null };
type Personal = { id: string; offers: Offer[] };

async function setup(q: Q, h: Helpers) {
  const gym = await h.gym();
  const daiana = await h.trainer(gym);
  await q("update profiles set name = 'Daiana Teodoro', phone = '22998001234' where id = $1", [daiana]);
  const aluno = await h.student(gym, "Rafael Souza");
  return { gym, daiana, aluno };
}

async function offer(q: Q, h: Helpers, trainer: string, gym: string, title: string, price: number | null, active = true) {
  await h.asApp(trainer);
  const [r] = await q<{ id: string }>(
    "insert into personal_offers (gym_id, trainer_id, title, price_cents, sessions_per_week, duration_label, active) values ($1, $2, $3, $4, 3, 'por mês', $5) returning id",
    [gym, trainer, title, price, active]
  );
  await h.asDb();
  return r.id;
}

test("personal cria plano; aluno vê só os planos ativos dentro do perfil do personal", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana, aluno } = await setup(q, h);
    await offer(q, h, daiana, gym, "Acompanhamento 3x/semana", 25000);
    await offer(q, h, daiana, gym, "Plano pausado", 10000, false);
    await h.asApp(aluno);
    const [r] = await q<{ p: Personal[] }>("select public.gym_personals() p");
    await h.asDb();
    const d = r.p.find((x) => x.id === daiana)!;
    assert.deepEqual(d.offers.map((o) => o.title), ["Acompanhamento 3x/semana"]);
    assert.equal(d.offers[0].price_cents, 25000);
  });
});

test("aluno não cria plano e personal não mexe no plano de outro personal", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana, aluno } = await setup(q, h);
    const outro = await h.trainer(gym);
    const id = await offer(q, h, daiana, gym, "Plano da Daiana", 20000);

    await h.asApp(aluno);
    await h.rejects(
      "insert into personal_offers (gym_id, trainer_id, title) values ($1, $2, 'x')", [gym, aluno], /row-level security/
    );
    await h.asDb();

    await h.asApp(outro);
    await q("update personal_offers set price_cents = 1 where id = $1", [id]);
    await h.rejects(
      "insert into personal_offers (gym_id, trainer_id, title) values ($1, $2, 'em nome dela')", [gym, daiana], /row-level security/
    );
    await h.asDb();
    const [row] = await q<{ price_cents: number }>("select price_cents from personal_offers where id = $1", [id]);
    assert.equal(row.price_cents, 20000, "outro personal não pode alterar o preço");
  });
});

test("aluno de outra academia não vê o plano", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana } = await setup(q, h);
    await offer(q, h, daiana, gym, "Plano local", 15000);
    const outra = await h.gym();
    const estranho = await h.student(outra);
    await h.asApp(estranho);
    const rows = await q("select * from personal_offers");
    await h.asDb();
    assert.equal(rows.length, 0);
  });
});

test("pedir um plano registra plano e preço e avisa só aquele personal", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana, aluno } = await setup(q, h);
    const outro = await h.trainer(gym);
    const id = await offer(q, h, daiana, gym, "Acompanhamento 3x/semana", 25000);
    await h.asApp(aluno);
    const [r] = await q<{ r: { ok: boolean; offer: string } }>("select public.request_coaching($1, null, $2) r", [daiana, id]);
    await h.asDb();
    assert.equal(r.r.ok, true);
    const [req] = await q<{ details: string }>("select details from premium_requests where student_id = $1", [aluno]);
    assert.match(req.details, /^\[acompanhamento\] \(com Daiana Teodoro · Acompanhamento 3x\/semana · R\$ 250,00\)/);
    const avisos = await q<{ user_id: string; body: string }>("select user_id, body from notifications where title = 'Pedido de acompanhamento'");
    assert.deepEqual(avisos.map((a) => a.user_id), [daiana]);
    assert.match(avisos[0].body, /plano "Acompanhamento 3x\/semana"/);
    assert.ok(!avisos.some((a) => a.user_id === outro));
  });
});

test("plano de outro personal (ou pausado) é recusado no pedido", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana, aluno } = await setup(q, h);
    const outro = await h.trainer(gym);
    const doOutro = await offer(q, h, outro, gym, "Plano do outro", 10000);
    const pausado = await offer(q, h, daiana, gym, "Pausado", 10000, false);
    await h.asApp(aluno);
    await h.rejects("select public.request_coaching($1, null, $2)", [daiana, doOutro], /Plano indisponível/);
    await h.rejects("select public.request_coaching($1, null, $2)", [daiana, pausado], /Plano indisponível/);
  });
});

test("plano sem preço aparece como 'a combinar' no pedido", async () => {
  await withTx(async (q, h) => {
    const { gym, daiana, aluno } = await setup(q, h);
    const id = await offer(q, h, daiana, gym, "Consultoria online", null);
    await h.asApp(aluno);
    await q("select public.request_coaching($1, null, $2)", [daiana, id]);
    await h.asDb();
    const [req] = await q<{ details: string }>("select details from premium_requests where student_id = $1", [aluno]);
    assert.match(req.details, /Consultoria online · valor a combinar/);
  });
});
