import test from "node:test";
import assert from "node:assert/strict";
import { addDays, todaySP, withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Campanhas de fim de ano (migration 079): desafio com ranking, cards de
 * oferta com prazo e preço promocional nos planos dos personais.
 */

async function challenge(q: Q, gym: string, startOffset = -3, endOffset = 30, goal = 10) {
  const hoje = await todaySP(q);
  const [c] = await q<{ id: string }>(
    `insert into challenges (gym_id, title, starts_on, ends_on, goal_days, prize_text)
     values ($1, 'Desafio Verão', $2, $3, $4, 'Top 3 ganha prêmio') returning id`,
    [gym, addDays(hoje, startOffset), addDays(hoje, endOffset), goal]
  );
  return c.id;
}

async function join(q: Q, h: Helpers, student: string, id: string) {
  await h.asApp(student);
  const [r] = await q<{ r: { ok: boolean; reason?: string } }>("select public.join_challenge($1) r", [id]);
  await h.asDb();
  return r.r;
}

type Board = { id: string; name: string; days: number; me: boolean; rank: number }[];
async function board(q: Q, h: Helpers, student: string, id: string) {
  await h.asApp(student);
  const [r] = await q<{ b: { participants: number; rows: Board } }>("select public.challenge_board($1) b", [id]);
  await h.asDb();
  return r.b;
}

test("aluno entra no desafio: vira participante, post no feed e aviso", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const ana = await h.student(gym, "Ana Lima");
    const id = await challenge(q, gym);
    assert.equal((await join(q, h, ana, id)).ok, true);
    assert.equal((await join(q, h, ana, id)).reason, "ja_participa");
    const [p] = await q<{ body: string }>("select body from feed_posts where author_id = $1", [ana]);
    assert.match(p.body, /Ana L\. entrou no Desafio Verão/);
    const [pts] = await q<{ n: number }>("select count(*)::int n from point_events where student_id = $1 and source = 'feed_post'", [ana]);
    assert.equal(pts.n, 0, "post do sistema não dá pontos de postagem");
  });
});

test("ranking conta dias treinados DENTRO do período, maior primeiro", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const ana = await h.student(gym, "Ana Lima");
    const bia = await h.student(gym, "Bia Souza");
    const id = await challenge(q, gym, -3, 30);
    await join(q, h, ana, id);
    await join(q, h, bia, id);
    const hoje = await todaySP(q);
    for (const n of [0, -1, -2]) await h.logOn(gym, ana, addDays(hoje, n));
    await h.logOn(gym, bia, hoje);
    await h.logOn(gym, bia, addDays(hoje, -10)); // antes do desafio: não conta
    const b = await board(q, h, bia, id);
    assert.equal(b.participants, 2);
    assert.deepEqual(b.rows.map((r) => [r.name, r.days, r.rank]), [["Ana L.", 3, 1], ["Bia S.", 1, 2]]);
    assert.equal(b.rows.find((r) => r.me)?.name, "Bia S.");
  });
});

test("não entra em desafio encerrado nem de outra academia", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const outra = await h.gym();
    const ana = await h.student(gym);
    const acabou = await challenge(q, gym, -40, -1);
    const alheio = await challenge(q, outra);
    assert.equal((await join(q, h, ana, acabou)).reason, "encerrado");
    assert.equal((await join(q, h, ana, alheio)).reason, "indisponivel");
  });
});

test("cards de campanha: aluno vê só os ativos e no prazo, da academia dele", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const ana = await h.student(gym);
    await q(
      `insert into promo_campaigns (gym_id, title, starts_at, ends_at, active) values
        ($1, 'No ar', now() - interval '1 day', now() + interval '5 days', true),
        ($1, 'Futura', now() + interval '3 days', now() + interval '9 days', true),
        ($1, 'Acabou', now() - interval '9 days', now() - interval '1 day', true),
        ($1, 'Pausada', now() - interval '1 day', now() + interval '5 days', false)`,
      [gym]
    );
    await h.asApp(ana);
    const rows = await q<{ title: string }>("select title from promo_campaigns");
    await h.asDb();
    assert.deepEqual(rows.map((r) => r.title), ["No ar"]);
  });
});

test("aluno não cria campanha nem desafio", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const ana = await h.student(gym);
    await h.asApp(ana);
    await h.rejects("insert into promo_campaigns (gym_id, title, starts_at, ends_at) values ($1, 'x', now(), now() + interval '1 day')", [gym], /row-level security/);
    await h.rejects("insert into challenges (gym_id, title, starts_on, ends_on, goal_days) values ($1, 'x', current_date, current_date + 1, 5)", [gym], /row-level security/);
  });
});

test("plano com preço Black Friday: vale só até a data, e o pedido registra o preço promocional", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const daiana = await h.trainer(gym);
    await q("update profiles set name = 'Daiana Teodoro' where id = $1", [daiana]);
    const ana = await h.student(gym);
    const [o] = await q<{ id: string }>(
      `insert into personal_offers (gym_id, trainer_id, title, price_cents, promo_price_cents, promo_label, promo_until)
       values ($1, $2, 'Plano 3x', 25000, 19900, 'Black Friday', current_date + 5) returning id`,
      [gym, daiana]
    );
    const [vencido] = await q<{ id: string }>(
      `insert into personal_offers (gym_id, trainer_id, title, price_cents, promo_price_cents, promo_label, promo_until)
       values ($1, $2, 'Plano antigo', 20000, 10000, 'Black Friday', current_date - 1) returning id`,
      [gym, daiana]
    );
    await h.asApp(ana);
    const [r] = await q<{ p: Array<{ offers: Array<{ id: string; promo_price_cents: number | null }> }> }>("select public.gym_personals() p");
    await q("select public.request_coaching($1, null, $2)", [daiana, o.id]);
    await h.asDb();
    const offers = r.p[0].offers;
    assert.equal(offers.find((x) => x.id === o.id)?.promo_price_cents, 19900);
    assert.equal(offers.find((x) => x.id === vencido.id)?.promo_price_cents, null, "promoção vencida some");
    const [req] = await q<{ details: string }>("select details from premium_requests where student_id = $1", [ana]);
    assert.match(req.details, /Plano 3x · Black Friday R\$ 199,00 \(de R\$ 250,00\)/);
  });
});
