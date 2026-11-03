import test from "node:test";
import assert from "node:assert/strict";
import { addDays, DOW_LABEL, isoDow, todaySP, withTx } from "./harness.mts";

/**
 * day_streak usa now() de verdade, então os cenários são montados a partir
 * de "hoje" em São Paulo (dias relativos), e não de datas fixas.
 */

const ALL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

test("sem treino nenhum a sequência é 0", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    assert.equal(await h.streak(aluno), 0);
  });
});

test("treinou hoje, ontem e anteontem: 3", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (const n of [0, -1, -2]) await h.logOn(gym, aluno, addDays(hoje, n));
    assert.equal(await h.streak(aluno), 3);
  });
});

test("hoje ainda sem treino não zera: conta até ontem", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    for (const n of [-1, -2]) await h.logOn(gym, aluno, addDays(hoje, n));
    assert.equal(await h.streak(aluno), 2);
  });
});

test("vários exercícios no mesmo dia contam como 1 dia", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const ontem = addDays(await todaySP(q), -1);
    for (let i = 0; i < 4; i++) await h.logOn(gym, aluno, ontem);
    assert.equal(await h.streak(aluno), 1);
  });
});

test("dia marcado perdido sem reposição quebra a sequência", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    // ontem e anteontem treinou; 3 dias atrás faltou; 4 e 5 dias atrás treinou
    for (const n of [-1, -2, -4, -5]) await h.logOn(gym, aluno, addDays(hoje, n));
    assert.equal(await h.streak(aluno), 2);
  });
});

test("dia de descanso (fora da ficha) não quebra a sequência", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    const hoje = await todaySP(q);
    const descanso = isoDow(addDays(hoje, -2));
    await h.plan(gym, aluno, ALL.filter((_, i) => i + 1 !== descanso));
    for (const n of [-1, -3]) await h.logOn(gym, aluno, addDays(hoje, n));
    assert.equal(await h.streak(aluno), 2);
  });
});

/** Segunda-feira da semana passada (ISO) a partir de hoje. */
function lastWeekMonday(hoje: string): string {
  return addDays(hoje, -(isoDow(hoje) - 1) - 7);
}

test("reposição: ficha seg/qua/sex, treinou ter/qui/sex — sequência continua", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ["Seg", "Qua", "Sex"]);
    const hoje = await todaySP(q);
    const seg = lastWeekMonday(hoje);
    // semana atual: treinou todo dia até ontem (se hoje é segunda, nenhum)
    const diasSemanaAtual = isoDow(hoje) - 1;
    for (let i = 1; i <= diasSemanaAtual; i++) await h.logOn(gym, aluno, addDays(hoje, -i));
    // semana passada: ter, qui, sex (2 faltas — seg e qua — repostas por ter e qui)
    for (const n of [1, 3, 4]) await h.logOn(gym, aluno, addDays(seg, n));
    assert.equal(await h.streak(aluno), diasSemanaAtual + 3);
  });
});

test("reposição só cobre uma falta por treino extra", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ["Seg", "Qua", "Sex"]);
    const hoje = await todaySP(q);
    const seg = lastWeekMonday(hoje);
    const diasSemanaAtual = isoDow(hoje) - 1;
    for (let i = 1; i <= diasSemanaAtual; i++) await h.logOn(gym, aluno, addDays(hoje, -i));
    // só ter e sex: a terça repõe a quarta, mas a segunda fica sem reposição
    for (const n of [1, 4]) await h.logOn(gym, aluno, addDays(seg, n));
    assert.equal(await h.streak(aluno), diasSemanaAtual + 2);
  });
});

test("treino às 23h30 de São Paulo conta no dia de São Paulo, não no UTC", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ALL);
    const hoje = await todaySP(q);
    const [e] = await q<{ id: string }>("insert into exercises (name, category) values ('Agacho', 'perna') returning id");
    // anteontem 23h30 SP = ontem 02h30 UTC. Ontem (SP) ficou sem treino → 0.
    await q(
      "insert into workout_logs (gym_id, student_id, exercise_id, date) values ($1, $2, $3, ($4::date + time '23:30') at time zone 'America/Sao_Paulo')",
      [gym, aluno, e.id, addDays(hoje, -2)]
    );
    assert.equal(await h.streak(aluno), 0);
  });
});

test("dias da ficha vêm do daysSelected, com ou sem acento", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    await h.plan(gym, aluno, ["seg", "Sábado", "DOM"]);
    const [r] = await q<{ d: number[] }>("select public.student_scheduled_days($1) d", [aluno]);
    assert.deepEqual(r.d, [1, 6, 7]);
  });
});

test("aluno sem ficha: todos os dias contam como marcados", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await h.student(gym);
    const [r] = await q<{ d: number[] }>("select public.student_scheduled_days($1) d", [aluno]);
    assert.deepEqual(r.d, [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(DOW_LABEL[7], "Dom");
  });
});
