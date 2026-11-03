import test from "node:test";
import assert from "node:assert/strict";
import { withTx } from "./harness.mts";

/**
 * Acompanhamento (migration 075): o aluno vê os personais da academia
 * (foto, nome, bio, WhatsApp), escolhe um, o pedido é registrado e SÓ o
 * personal escolhido é avisado; o app abre o WhatsApp dele com mensagem.
 */

type Personal = { id: string; name: string; bio: string | null; avatar_url: string | null; phone: string | null };

test("aluno vê os personais da academia dele, com telefone para o WhatsApp", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const outra = await h.gym();
    const daiana = await h.trainer(gym);
    await q("update profiles set name = 'Daiana Teodoro', phone = '(22) 99800-1234', bio = 'Hipertrofia e glúteo' where id = $1", [daiana]);
    const deFora = await h.trainer(outra);
    const aluno = await h.student(gym);

    await h.asApp(aluno);
    const [r] = await q<{ p: Personal[] }>("select public.gym_personals() p");
    await h.asDb();
    assert.equal(r.p.filter((x) => x.id === daiana).length, 1);
    assert.equal(r.p[0].phone, "(22) 99800-1234");
    assert.equal(r.p[0].bio, "Hipertrofia e glúteo");
    assert.ok(!r.p.some((x) => x.id === deFora));
  });
});

test("gestores também aparecem como personais (personais primeiro)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const daiana = await h.trainer(gym);
    const claudeir = await h.trainer(gym);
    await q("update profiles set role = 'manager' where id = $1", [claudeir]);
    const aluno = await h.student(gym);
    await h.asApp(aluno);
    const [r] = await q<{ p: Personal[] }>("select public.gym_personals() p");
    await h.asDb();
    assert.deepEqual(r.p.map((x) => x.id), [daiana, claudeir]);
  });
});

test("pedir acompanhamento registra o pedido e avisa SÓ o personal escolhido", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const daiana = await h.trainer(gym);
    const outro = await h.trainer(gym);
    await q("update profiles set name = 'Daiana Teodoro', phone = '22998001234' where id = $1", [daiana]);
    const aluno = await h.student(gym, "Rafael Souza");

    await h.asApp(aluno);
    const [r] = await q<{ r: { ok: boolean; phone: string; name: string } }>(
      "select public.request_coaching($1, $2) r", [daiana, "Quero ganhar massa"]
    );
    await h.asDb();
    assert.equal(r.r.ok, true);
    assert.equal(r.r.phone, "22998001234");

    const [req] = await q<{ details: string; status: string }>("select details, status from premium_requests where student_id = $1", [aluno]);
    assert.match(req.details, /^\[acompanhamento\] \(com Daiana Teodoro\) Quero ganhar massa/);
    assert.equal(req.status, "pending");

    const avisos = await q<{ user_id: string; body: string }>(
      "select user_id, body from notifications where title = 'Pedido de acompanhamento'"
    );
    assert.deepEqual(avisos.map((a) => a.user_id), [daiana]);
    assert.match(avisos[0].body, /Rafael Souza quer acompanhamento com você/);
    assert.ok(!avisos.some((a) => a.user_id === outro));
  });
});

test("não dá para pedir acompanhamento a alguém que não é da equipe da academia", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const outra = await h.gym();
    const deFora = await h.trainer(outra);
    const colega = await h.student(gym);
    const aluno = await h.student(gym);
    await h.asApp(aluno);
    await h.rejects("select public.request_coaching($1, null)", [deFora], /Personal não encontrado/);
    await h.rejects("select public.request_coaching($1, null)", [colega], /Personal não encontrado/);
  });
});
