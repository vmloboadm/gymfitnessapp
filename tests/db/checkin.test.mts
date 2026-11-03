import test from "node:test";
import assert from "node:assert/strict";
import { withTx } from "./harness.mts";

type Res = { ok: boolean; existing?: boolean; closed?: boolean; already_closed?: boolean; checkin_id?: string; session_id?: string };

const start = async (q: Parameters<Parameters<typeof withTx>[0]>[0], source = "app") =>
  (await q<{ r: Res }>("select public.start_checkin($1) r", [source]))[0].r;
const close = async (q: Parameters<Parameters<typeof withTx>[0]>[0], session: string | null = null) =>
  (await q<{ r: Res }>("select public.close_checkin($1) r", [session]))[0].r;

test("check-in sem login é recusado", async () => {
  await withTx(async (q, h) => {
    await h.as(null);
    await assert.rejects(() => start(q), /Não autenticado/);
  });
});

test("check-in abre a entrada e a sessão de treino ligadas entre si", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);

    const r = await start(q, "qrcode");
    assert.equal(r.ok, true);
    assert.equal(r.existing, false);

    const [c] = await q<{ type: string; source: string; workout_session_id: string }>(
      "select type, source, workout_session_id from checkins where id = $1", [r.checkin_id]
    );
    assert.equal(c.type, "entrada");
    assert.equal(c.source, "qrcode");
    assert.equal(c.workout_session_id, r.session_id);

    const [s] = await q<{ status: string }>("select status from workout_sessions where id = $1", [r.session_id]);
    assert.equal(s.status, "active");
  });
});

test("fonte desconhecida vira 'app' em vez de quebrar", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    await h.as(await h.student(gym));
    const r = await start(q, "hacker");
    const [c] = await q<{ source: string }>("select source from checkins where id = $1", [r.checkin_id]);
    assert.equal(c.source, "app");
  });
});

test("check-in repetido no mesmo dia devolve o mesmo, sem duplicar", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);

    const a = await start(q);
    const b = await start(q);
    assert.equal(b.existing, true);
    assert.equal(b.checkin_id, a.checkin_id);
    assert.equal(b.session_id, a.session_id);

    const [n] = await q<{ n: number }>("select count(*)::int n from checkins where student_id = $1 and type = 'entrada'", [aluno]);
    assert.equal(n.n, 1);
  });
});

test("check-in dá 5 pontos uma única vez por dia", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);
    const first = await start(q);
    await close(q, first.session_id!);
    await start(q); // reentrada no mesmo dia
    const [p] = await q<{ total: number; n: number }>(
      "select coalesce(sum(points),0)::int total, count(*)::int n from point_events where student_id = $1 and source = 'checkin'", [aluno]
    );
    assert.equal(p.n, 1);
    assert.equal(p.total, 5);
  });
});

test("inserir 2ª entrada aberta no mesmo dia é bloqueado pelo banco", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await q("insert into checkins (gym_id, student_id, type, source) values ($1, $2, 'entrada', 'app')", [gym, aluno]);
    await assert.rejects(
      () => q("insert into checkins (gym_id, student_id, type, source) values ($1, $2, 'entrada', 'app')", [gym, aluno]),
      /Check-in de entrada já realizado hoje/
    );
  });
});

test("finalizar fecha a presença e a sessão; repetir não cria outra saída", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);
    const r = await start(q);

    const c1 = await close(q, r.session_id!);
    assert.equal(c1.closed, true);
    const [s] = await q<{ status: string; ended_at: string | null }>(
      "select status, ended_at from workout_sessions where id = $1", [r.session_id]
    );
    assert.equal(s.status, "completed");
    assert.ok(s.ended_at);

    const c2 = await close(q, r.session_id!);
    assert.equal(c2.already_closed, true);
    const [n] = await q<{ n: number }>("select count(*)::int n from checkins where student_id = $1 and type = 'saida'", [aluno]);
    assert.equal(n.n, 1);
  });
});

test("fechar sem nada aberto responde sem erro", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    await h.as(await h.student(gym));
    const r = await close(q);
    assert.equal(r.ok, true);
    assert.equal(r.closed, false);
  });
});

test("depois de sair, o aluno pode entrar de novo no mesmo dia (sessão nova)", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.as(aluno);
    const a = await start(q);
    await close(q, a.session_id!);
    // garante ordem temporal entre saída e nova entrada dentro da transação
    await q("update checkins set checked_at = checked_at - interval '1 hour' where student_id = $1", [aluno]);
    await q("update checkins set checked_at = checked_at - interval '1 hour' where student_id = $1 and type = 'entrada'", [aluno]);

    const b = await start(q);
    assert.equal(b.existing, false);
    assert.notEqual(b.checkin_id, a.checkin_id);
    assert.notEqual(b.session_id, a.session_id);
  });
});

test("entrada esquecida de ontem não prende o check-in de hoje", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await q(
      "insert into checkins (gym_id, student_id, type, source, checked_at) values ($1, $2, 'entrada', 'app', now() - interval '1 day')",
      [gym, aluno]
    );
    await h.as(aluno);
    const r = await start(q);
    assert.equal(r.existing, false);
  });
});

test("sessão com mais de 3h fecha sozinha às 3h; a de 1h continua aberta", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const velho = await h.student(gym, "Esqueceu Aberto");
    const novo = await h.student(gym, "Treinando Agora");

    const [sv] = await q<{ id: string }>(
      "insert into workout_sessions (gym_id, student_id, status, started_at) values ($1, $2, 'active', now() - interval '4 hours') returning id",
      [gym, velho]
    );
    await q(
      "insert into checkins (gym_id, student_id, type, source, checked_at, workout_session_id) values ($1, $2, 'entrada', 'app', now() - interval '4 hours', $3)",
      [gym, velho, sv.id]
    );
    const [sn] = await q<{ id: string }>(
      "insert into workout_sessions (gym_id, student_id, status, started_at) values ($1, $2, 'active', now() - interval '1 hour') returning id",
      [gym, novo]
    );

    await h.as(null); // como o pg_cron (sem usuário)
    const [r] = await q<{ n: number }>("select public.auto_close_stale_workouts() n");
    assert.equal(Number(r.n), 1);

    const [v] = await q<{ status: string; auto: boolean; dur: string }>(
      "select status, (meta->>'auto_finished')::boolean auto, (ended_at - started_at)::text dur from workout_sessions where id = $1", [sv.id]
    );
    assert.equal(v.status, "completed");
    assert.equal(v.auto, true);
    assert.equal(v.dur, "03:00:00");

    const [saida] = await q<{ n: number }>("select count(*)::int n from checkins where workout_session_id = $1 and type = 'saida'", [sv.id]);
    assert.equal(saida.n, 1);

    const [n2] = await q<{ status: string }>("select status from workout_sessions where id = $1", [sn.id]);
    assert.equal(n2.status, "active");
  });
});

test("aluno não pode fechar sessão de outro aluno", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const a = await h.student(gym);
    const b = await h.student(gym);
    await h.as(a);
    await assert.rejects(() => q("select public.auto_close_stale_workouts($1)", [b]), /Sem permissão/);
  });
});
