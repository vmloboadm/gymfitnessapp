import test from "node:test";
import assert from "node:assert/strict";
import { addDays, todaySP, withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Desafio + comunidade (migration 080): convite por WhatsApp para quem ainda
 * não entrou, "dar força" entre participantes e post semanal com o Top 3.
 */

async function setup(q: Q, h: Helpers) {
  const gym = await h.gym();
  const gestor = await h.trainer(gym);
  await q("update profiles set role = 'manager', name = 'Claudeir Machado' where id = $1", [gestor]);
  const hoje = await todaySP(q);
  const [c] = await q<{ id: string }>(
    "insert into challenges (gym_id, title, starts_on, ends_on, goal_days) values ($1, 'Desafio Verão', $2, $3, 24) returning id",
    [gym, addDays(hoje, -5), addDays(hoje, 40)]
  );
  return { gym, gestor, ch: c.id };
}

async function join(q: Q, h: Helpers, id: string, ch: string) {
  await h.asApp(id);
  await q("select public.join_challenge($1)", [ch]);
  await h.asDb();
}

test("convite do desafio vai só para quem tem consentimento e ainda não entrou, a partir da data", async () => {
  await withTx(async (q, h) => {
    const { gym, ch } = await setup(q, h);
    const ana = await h.student(gym, "Ana Lima");
    const bia = await h.student(gym, "Bia Souza");
    const caio = await h.student(gym, "Caio Sem");
    await q("update profiles set phone = '22998001111', whatsapp_consent = true where id in ($1, $2)", [ana, bia]);
    await q("update profiles set phone = '22998003333', whatsapp_consent = false where id = $1", [caio]);
    await join(q, h, bia, ch);
    const [r] = await q<{ n: number }>("select public.enqueue_challenge_campaign($1, $2, '2026-11-09 09:00:00-03') n", [gym, ch]);
    assert.equal(Number(r.n), 1);
    const [row] = await q<{ student_id: string; body: string; scheduled_at: string; campaign: string }>(
      "select student_id, body, scheduled_at, campaign from whatsapp_outbox"
    );
    assert.equal(row.student_id, ana);
    assert.match(row.body, /Ana/);
    assert.match(row.body, /Desafio Verão/);
    assert.match(row.body, /gymfitnesscampos\.com\.br\/app/);
    assert.ok(new Date(row.scheduled_at) >= new Date("2026-11-09T12:00:00Z"));
    assert.equal(row.campaign, `desafio:${ch}`);
  });
});

test("dar força: avisa o colega, 1 vez por dia por pessoa, só para quem está no desafio", async () => {
  await withTx(async (q, h) => {
    const { gym, ch } = await setup(q, h);
    const ana = await h.student(gym, "Ana Lima");
    const bia = await h.student(gym, "Bia Souza");
    const fora = await h.student(gym, "Fora Desafio");
    await join(q, h, ana, ch);
    await join(q, h, bia, ch);
    await h.asApp(ana);
    const [r1] = await q<{ r: { ok: boolean } }>("select public.challenge_cheer($1, $2) r", [ch, bia]);
    const [r2] = await q<{ r: { ok: boolean; reason?: string } }>("select public.challenge_cheer($1, $2) r", [ch, bia]);
    const [r3] = await q<{ r: { ok: boolean; reason?: string } }>("select public.challenge_cheer($1, $2) r", [ch, fora]);
    const [r4] = await q<{ r: { ok: boolean; reason?: string } }>("select public.challenge_cheer($1, $2) r", [ch, ana]);
    await h.asDb();
    assert.equal(r1.r.ok, true);
    assert.equal(r2.r.reason, "ja_deu_hoje");
    assert.equal(r3.r.reason, "nao_participa");
    assert.equal(r4.r.reason, "voce_mesmo");
    const avisos = await q<{ body: string }>("select body from notifications where user_id = $1 and title = 'Força no desafio 💪'", [bia]);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].body, /Ana L\. te deu força/);
  });
});

test("post semanal no feed com o Top 3 e quantos estão no desafio", async () => {
  await withTx(async (q, h) => {
    const { gym, gestor, ch } = await setup(q, h);
    const hoje = await todaySP(q);
    const nomes = ["Ana Lima", "Bia Souza", "Caio Reis", "Duda Melo"];
    const ids: string[] = [];
    for (const n of nomes) ids.push(await h.student(gym, n));
    for (const id of ids) await join(q, h, id, ch);
    for (const [i, id] of ids.entries()) for (let d = 0; d < 4 - i; d++) await h.logOn(gym, id, addDays(hoje, -d));
    const [r] = await q<{ n: number }>("select public.post_challenge_weekly_updates() n");
    assert.equal(Number(r.n), 1);
    const [p] = await q<{ body: string; type: string; author_id: string }>(
      "select body, type, author_id from feed_posts where type = 'desafio'"
    );
    assert.equal(p.author_id, gestor);
    assert.match(p.body, /1º Ana L\. \(4 dias\)/);
    assert.match(p.body, /2º Bia S\. \(3 dias\)/);
    assert.match(p.body, /3º Caio R\. \(2 dias\)/);
    assert.doesNotMatch(p.body, /Duda/);
    assert.match(p.body, /4 pessoas no desafio/);
  });
});

test("post semanal não sai para desafio sem participantes ou encerrado", async () => {
  await withTx(async (q, h) => {
    await setup(q, h);
    const [r] = await q<{ n: number }>("select public.post_challenge_weekly_updates() n");
    assert.equal(Number(r.n), 0);
  });
});
