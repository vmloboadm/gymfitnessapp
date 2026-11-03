import test from "node:test";
import assert from "node:assert/strict";
import { withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Treino inicial automático (migration 073): o personal marca fichas como
 * modelo inicial; aluno aprovado sem ficha recebe uma cópia do modelo que
 * mais combina (nível + nº de dias). Risco médico fica com o personal.
 */

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

async function program(q: Q, gym: string, trainer: string, name: string, nDays: number, days?: string[]): Promise<string> {
  const [e] = await q<{ id: string }>("insert into exercises (name, category) values ($1, 'peito') returning id", [`Ex ${name}`]);
  const [p] = await q<{ id: string }>(
    "insert into workout_programs (gym_id, trainer_id, name, ai_draft) values ($1, $2, $3, $4) returning id",
    [gym, trainer, name, JSON.stringify({ nome: name, daysSelected: days ?? WEEK.slice(0, nDays), dias: [] })]
  );
  for (let i = 1; i <= nDays; i++) {
    const [d] = await q<{ id: string }>(
      "insert into workout_days (gym_id, program_id, name, day_order) values ($1, $2, $3, $4) returning id",
      [gym, p.id, `Dia ${i}`, i]
    );
    for (let j = 1; j <= 4; j++) {
      await q(
        "insert into workout_exercises (gym_id, day_id, exercise_id, sets, reps, rest_seconds, ord) values ($1, $2, $3, 3, '12', 60, $4)",
        [gym, d.id, e.id, j]
      );
    }
  }
  return p.id;
}

async function template(q: Q, gym: string, programId: string, levels: string[] | null, label: string) {
  await q("insert into starter_templates (gym_id, program_id, label, levels) values ($1, $2, $3, $4)", [gym, programId, label, levels]);
}

/** Aluno do jeito que chega do cadastro: ainda NÃO aprovado. */
async function pending(q: Q, h: Helpers, gym: string, level: string, days: string[], extra = ""): Promise<string> {
  const id = await h.student(gym, "Carla Mendes");
  await q(`update profiles set approved_at = null, experience_level = $2, available_days = $3 ${extra} where id = $1`, [id, level, days]);
  return id;
}

async function approve(q: Q, id: string) {
  await q("update profiles set approved_at = now() where id = $1", [id]);
}

async function active(q: Q, student: string) {
  return q<{ program_id: string; name: string; created_via: string; days: number; exs: number; draft: string }>(
    `select sw.program_id, wp.name, wp.created_via, wp.ai_draft draft,
       (select count(*)::int from workout_days d where d.program_id = wp.id) days,
       (select count(*)::int from workout_exercises we join workout_days d on d.id = we.day_id where d.program_id = wp.id) exs
     from student_workouts sw join workout_programs wp on wp.id = sw.program_id
     where sw.student_id = $1 and sw.status = 'active'`,
    [student]
  );
}

async function setup(q: Q, h: Helpers) {
  const gym = await h.gym();
  const trainer = await h.trainer(gym);
  const ini3 = await program(q, gym, trainer, "Full Body Iniciante 3x", 3);
  const int5 = await program(q, gym, trainer, "ABCDE Intermediário", 5, ["Seg", "Ter", "Qua", "Qui", "Sáb"]);
  await template(q, gym, ini3, ["Iniciante"], "Iniciante 3x");
  await template(q, gym, int5, ["Intermediário", "Avançado"], "Intermediário 5x");
  return { gym, trainer, ini3, int5 };
}

test("aluno aprovado sem ficha recebe a cópia do modelo que combina", async () => {
  await withTx(async (q, h) => {
    const { gym, int5 } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Intermediário", ["Seg", "Ter", "Qua", "Qui", "Sex"]);
    await approve(q, aluno);

    const [a] = await active(q, aluno);
    assert.ok(a, "deveria ter ficha ativa");
    assert.notEqual(a.program_id, int5, "tem que ser uma CÓPIA, não o modelo");
    assert.equal(a.days, 5);
    assert.equal(a.exs, 20);
    assert.equal(a.created_via, "template");
    assert.match(a.name, /Carla/);
  });
});

test("a cópia segue os dias que o aluno escolheu quando a quantidade bate", async () => {
  await withTx(async (q, h) => {
    const { gym } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Intermediário", ["Seg", "Ter", "Qua", "Qui", "Sex"]);
    await approve(q, aluno);
    const [a] = await active(q, aluno);
    assert.deepEqual(JSON.parse(a.draft).daysSelected, ["Seg", "Ter", "Qua", "Qui", "Sex"]);
  });
});

test("iniciante de 3 dias recebe o modelo de iniciante", async () => {
  await withTx(async (q, h) => {
    const { gym } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Iniciante", ["Seg", "Qua", "Sex"]);
    await approve(q, aluno);
    const [a] = await active(q, aluno);
    assert.equal(a.days, 3);
  });
});

test("sem nível que combine, usa o modelo com nº de dias mais próximo", async () => {
  await withTx(async (q, h) => {
    const { gym } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Não sei", ["Seg", "Qua", "Sex"]);
    await approve(q, aluno);
    const [a] = await active(q, aluno);
    assert.equal(a.days, 3);
  });
});

test("aluno com risco médico NÃO recebe automático (fica com o personal)", async () => {
  await withTx(async (q, h) => {
    const { gym } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Iniciante", ["Seg", "Qua", "Sex"], ", medical_risk = true");
    await approve(q, aluno);
    assert.equal((await active(q, aluno)).length, 0);
  });
});

test("aluno que já tem ficha não perde a dele", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Iniciante", ["Seg", "Qua", "Sex"]);
    const propria = await program(q, gym, trainer, "Ficha da Carla", 2);
    await q("insert into student_workouts (gym_id, student_id, program_id, status) values ($1, $2, $3, 'active')", [gym, aluno, propria]);
    await approve(q, aluno);
    const fichas = await active(q, aluno);
    assert.equal(fichas.length, 1);
    assert.equal(fichas[0].program_id, propria);
  });
});

test("academia sem modelo: nada é aplicado e a aprovação não quebra", async () => {
  await withTx(async (q, h) => {
    const gym = await h.gym();
    const aluno = await pending(q, h, gym, "Iniciante", ["Seg"]);
    await approve(q, aluno);
    assert.equal((await active(q, aluno)).length, 0);
    assert.deepEqual(h.warnings(), []);
  });
});

test("aluno recebe 'Novo treino liberado' e a equipe é avisada para revisar", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await setup(q, h);
    const aluno = await pending(q, h, gym, "Iniciante", ["Seg", "Qua", "Sex"]);
    await approve(q, aluno);
    const [n] = await q<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and title = 'Novo treino liberado'", [aluno]);
    assert.equal(n.n, 1);
    const [s] = await q<{ body: string }>("select body from notifications where user_id = $1 and title = 'Treino inicial aplicado'", [trainer]);
    assert.match(s.body, /Carla/);
  });
});

test("aluno aprovado pode pegar o treino inicial pelo app (e só o dele)", async () => {
  await withTx(async (q, h) => {
    const { gym } = await setup(q, h);
    const aluno = await h.student(gym, "Pedro Lima");
    const outro = await h.student(gym, "Outro Aluno");
    await q("update profiles set experience_level = 'Iniciante', available_days = '{Seg,Qua,Sex}' where id in ($1, $2)", [aluno, outro]);

    await h.asApp(aluno);
    await h.rejects("select public.assign_starter_plan($1)", [outro], /Sem permissão/);
    const [r] = await q<{ r: { ok: boolean } }>("select public.assign_starter_plan($1) r", [aluno]);
    assert.equal(r.r.ok, true);
    // repetir não cria segunda ficha
    const [r2] = await q<{ r: { ok: boolean; reason?: string } }>("select public.assign_starter_plan($1) r", [aluno]);
    assert.equal(r2.r.reason, "ja_tem_ficha");
    await h.asDb();
    assert.equal((await active(q, aluno)).length, 1);
  });
});

test("aluno não consegue criar modelo; personal consegue", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await setup(q, h);
    const nova = await program(q, gym, trainer, "Ficha nova", 4);
    const aluno = await h.student(gym);
    await h.asApp(aluno);
    await h.rejects("insert into starter_templates (gym_id, program_id, label) values ($1, $2, 'x')", [gym, nova], /row-level security/);
    await h.asDb();
    await h.asApp(trainer);
    await q("insert into starter_templates (gym_id, program_id, label) values ($1, $2, 'Novo modelo')", [gym, nova]);
  });
});

test("personal aplica o treino inicial de uma vez em quem está sem ficha", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await setup(q, h);
    const a = await h.student(gym, "Ana Um");
    const b = await h.student(gym, "Bia Dois");
    const risco = await h.student(gym, "Cris Risco");
    await q("update profiles set medical_risk = true where id = $1", [risco]);
    await h.asApp(trainer);
    const [r] = await q<{ r: { applied: number; skipped: number } }>("select public.assign_starter_plans_bulk() r");
    await h.asDb();
    assert.equal(r.r.applied, 2);
    assert.equal((await active(q, a)).length, 1);
    assert.equal((await active(q, b)).length, 1);
    assert.equal((await active(q, risco)).length, 0);
  });
});
