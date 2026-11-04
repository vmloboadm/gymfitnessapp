import test from "node:test";
import assert from "node:assert/strict";
import { withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Laudo médico (migration 082): aluno com risco médico conclui o cadastro e
 * entra no app (antes travava no último passo para sempre); o TREINO continua
 * bloqueado até o laudo ser aprovado; a equipe é avisada.
 */

async function riskStudent(q: Q, h: Helpers, gym: string) {
  const id = await h.student(gym, "Kathleen Souza");
  await q("update profiles set medical_risk = true, status = 'pending_clearance', onboarding_completed = false where id = $1", [id]);
  return id;
}

test("aluno com risco médico conclui o cadastro (sem travar)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const k = await riskStudent(q, h, gym);
    await h.asApp(k);
    await q("select public.finish_onboarding()");
    await h.asDb();
    const [p] = await q<{ onboarding_completed: boolean; status: string }>("select onboarding_completed, status from profiles where id = $1", [k]);
    assert.equal(p.onboarding_completed, true);
    assert.equal(p.status, "pending_clearance", "continua aguardando o laudo");
  });
});

test("equipe é avisada que o aluno precisa enviar o laudo", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const gestor = await h.trainer(gym);
    const k = await riskStudent(q, h, gym);
    await h.asApp(k);
    await q("select public.finish_onboarding()");
    await q("select public.finish_onboarding()");
    await h.asDb();
    const rows = await q<{ body: string }>("select body from notifications where user_id = $1 and title = 'Aluno aguardando laudo'", [gestor]);
    assert.equal(rows.length, 1, "1 aviso só, mesmo concluindo 2x");
    assert.match(rows[0].body, /Kathleen/);
  });
});

test("laudo enviado avisa a equipe para analisar", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const gestor = await h.trainer(gym);
    const k = await riskStudent(q, h, gym);
    await q("insert into medical_clearances (gym_id, student_id, document_url) values ($1, $2, 'clearances/x/laudo.pdf')", [gym, k]);
    const [n] = await q<{ body: string }>("select body from notifications where user_id = $1 and title = 'Laudo para analisar'", [gestor]);
    assert.match(n.body, /Kathleen/);
  });
});

test("mesmo dentro do app, sem laudo aprovado não pega treino", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    await h.trainer(gym);
    const k = await riskStudent(q, h, gym);
    await h.asApp(k);
    await q("select public.finish_onboarding()");
    const [r] = await q<{ r: { ok: boolean; reason: string } }>("select public.assign_starter_plan($1) r", [k]);
    await h.asDb();
    assert.equal(r.r.reason, "avaliacao_medica");
  });
});
