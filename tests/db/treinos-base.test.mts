import test from "node:test";
import assert from "node:assert/strict";
import { withTx, type Helpers, type Q } from "./harness.mts";

/**
 * Treinos base (migration 074): 10 fichas prontas por academia, o aluno
 * escolhe e treina na hora; pedidos ao personal avisam a equipe.
 */

type Option = { id: string; label: string; split: string; level: string; days: string[]; exercises: number; recommended: boolean; is_base: boolean };

async function gymWithBase(q: Q, h: Helpers) {
  const gym = await h.gym();
  const trainer = await h.trainer(gym);
  const [r] = await q<{ n: number }>("select public.seed_base_programs($1) n", [gym]);
  return { gym, trainer, seeded: Number(r.n) };
}

async function student(q: Q, h: Helpers, gym: string, sex: "M" | "F", level: string, days: string[], approved = true) {
  const id = await h.student(gym, sex === "F" ? "Júlia Santos" : "Rafael Souza");
  await q(
    `update profiles set sex = $2, experience_level = $3, available_days = $4 ${approved ? "" : ", approved_at = null"} where id = $1`,
    [id, sex, level, days]
  );
  return id;
}

async function options(q: Q, h: Helpers, id: string): Promise<Option[]> {
  await h.asApp(id);
  const [r] = await q<{ o: Option[] }>("select public.starter_options() o");
  await h.asDb();
  return r.o;
}

async function pick(q: Q, h: Helpers, id: string, template: string) {
  await h.asApp(id);
  const [r] = await q<{ r: { ok: boolean; reason?: string } }>("select public.pick_starter_plan($1) r", [template]);
  await h.asDb();
  return r.r;
}

async function activePlan(q: Q, student: string) {
  return q<{ name: string; days: number; exs: number; draft: string }>(
    `select wp.name, wp.ai_draft draft,
       (select count(*)::int from workout_days d where d.program_id = wp.id) days,
       (select count(*)::int from workout_exercises we join workout_days d on d.id = we.day_id where d.program_id = wp.id) exs
     from student_workouts sw join workout_programs wp on wp.id = sw.program_id
     where sw.student_id = $1 and sw.status = 'active'`,
    [student]
  );
}

test("academia ganha 10 treinos base completos (5 masc., 5 fem.), todos com exercícios da biblioteca", async () => {
  await withTx(async (q, h) => {
    const { gym, seeded } = await gymWithBase(q, h);
    assert.equal(seeded, 10);
    const rows = await q<{ audience: string; split: string; nd: number; empty_days: number }>(
      `select s.audience, s.split,
         (select count(*)::int from workout_days d where d.program_id = s.program_id) nd,
         (select count(*)::int from workout_days d where d.program_id = s.program_id
            and not exists (select 1 from workout_exercises we where we.day_id = d.id)) empty_days
       from starter_templates s where s.gym_id = $1 and s.is_base`,
      [gym]
    );
    assert.equal(rows.filter((r) => r.audience === "M").length, 5);
    assert.equal(rows.filter((r) => r.audience === "F").length, 5);
    for (const r of rows) {
      assert.equal(r.nd, r.split.length, `${r.split} deveria ter ${r.split.length} dias`);
      assert.equal(r.empty_days, 0);
    }
    // rodar de novo não duplica
    const [again] = await q<{ n: number }>("select public.seed_base_programs($1) n", [gym]);
    assert.equal(Number(again.n), 0);
  });
});

test("aluna vê só treinos femininos, com 3 sugeridos no topo para o nível e os dias dela", async () => {
  await withTx(async (q, h) => {
    const { gym } = await gymWithBase(q, h);
    const julia = await student(q, h, gym, "F", "Intermediário", ["Seg", "Ter", "Qui", "Sex"]);
    const opts = await options(q, h, julia);
    assert.equal(opts.length, 5);
    assert.equal(opts.filter((o) => o.recommended).length, 3);
    assert.equal(opts[0].split, "ABCD", "intermediária de 4 dias → ABCD primeiro");
    assert.equal(opts[0].level, "Intermediário");
    assert.ok(opts[0].days.length === 4 && opts[0].exercises > 0);
  });
});

test("aluno escolhe o treino base e já tem ficha (sem esperar aprovação)", async () => {
  await withTx(async (q, h) => {
    const { gym } = await gymWithBase(q, h);
    const rafa = await student(q, h, gym, "M", "Iniciante", ["Seg", "Qua", "Sex"], false);
    const abc = (await options(q, h, rafa)).find((o) => o.split === "ABC" && o.level === "Iniciante")!;
    const r = await pick(q, h, rafa, abc.id);
    assert.equal(r.ok, true);
    const [plan] = await activePlan(q, rafa);
    assert.equal(plan.days, 3);
    assert.match(plan.name, /Iniciante · ABC · Rafael/);
    assert.deepEqual(JSON.parse(plan.draft).daysSelected, ["Seg", "Qua", "Sex"]);
  });
});

test("dá para trocar de treino base; o anterior vira histórico", async () => {
  await withTx(async (q, h) => {
    const { gym } = await gymWithBase(q, h);
    const rafa = await student(q, h, gym, "M", "Intermediário", ["Seg", "Ter", "Qui", "Sex"]);
    const opts = await options(q, h, rafa);
    await pick(q, h, rafa, opts.find((o) => o.split === "ABC")!.id);
    await pick(q, h, rafa, opts.find((o) => o.split === "ABCD")!.id);
    const plans = await activePlan(q, rafa);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].days, 4);
  });
});

test("ficha montada pelo personal nunca é trocada por treino base", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await gymWithBase(q, h);
    const rafa = await student(q, h, gym, "M", "Iniciante", ["Seg", "Qua", "Sex"]);
    const [p] = await q<{ id: string }>("insert into workout_programs (gym_id, trainer_id, name) values ($1, $2, 'Ficha do personal') returning id", [gym, trainer]);
    await q("insert into student_workouts (gym_id, student_id, program_id, status) values ($1, $2, $3, 'active')", [gym, rafa, p.id]);
    const opts = await options(q, h, rafa);
    const r = await pick(q, h, rafa, opts[0].id);
    assert.equal(r.reason, "ficha_do_personal");
    const plans = await activePlan(q, rafa);
    assert.equal(plans[0].name, "Ficha do personal");
  });
});

test("risco médico: não escolhe sozinho, fica com o personal", async () => {
  await withTx(async (q, h) => {
    const { gym } = await gymWithBase(q, h);
    const julia = await student(q, h, gym, "F", "Iniciante", ["Seg", "Qua", "Sex"]);
    await q("update profiles set medical_risk = true where id = $1", [julia]);
    const opts = await options(q, h, julia);
    const r = await pick(q, h, julia, opts[0].id);
    assert.equal(r.reason, "avaliacao_medica");
  });
});

test("aluno não pega modelo de outra academia", async () => {
  await withTx(async (q, h) => {
    const a = await gymWithBase(q, h);
    const b = await gymWithBase(q, h);
    const rafa = await student(q, h, a.gym, "M", "Iniciante", ["Seg"]);
    const [alheio] = await q<{ id: string }>("select id from starter_templates where gym_id = $1 limit 1", [b.gym]);
    const r = await pick(q, h, rafa, alheio.id);
    assert.equal(r.reason, "modelo_indisponivel");
  });
});

test("escolha avisa o personal (1 vez por dia), com convite para oferecer acompanhamento", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await gymWithBase(q, h);
    const rafa = await student(q, h, gym, "M", "Iniciante", ["Seg", "Qua", "Sex"]);
    const opts = await options(q, h, rafa);
    await pick(q, h, rafa, opts[0].id);
    await pick(q, h, rafa, opts[1].id);
    const rows = await q<{ body: string }>("select body from notifications where user_id = $1 and title = 'Aluno escolheu treino base'", [trainer]);
    assert.equal(rows.length, 1);
    assert.match(rows[0].body, /Rafael/);
  });
});

test("aprovação aplica o treino base certo para quem não escolheu", async () => {
  await withTx(async (q, h) => {
    const { gym } = await gymWithBase(q, h);
    const julia = await student(q, h, gym, "F", "Avançado", ["Seg", "Ter", "Qua", "Qui", "Sex"], false);
    await q("update profiles set approved_at = now() where id = $1", [julia]);
    const [plan] = await activePlan(q, julia);
    assert.equal(plan.days, 5);
    assert.match(plan.name, /Avançado · ABCDE/);
  });
});

test("pedido de acompanhamento avisa o personal no sininho", async () => {
  await withTx(async (q, h) => {
    const { gym, trainer } = await gymWithBase(q, h);
    const rafa = await student(q, h, gym, "M", "Iniciante", ["Seg"]);
    await q(
      "insert into premium_requests (gym_id, student_id, request_type, details, status) values ($1, $2, 'other', '[acompanhamento] Quero treinar com personal 3x', 'pending')",
      [gym, rafa]
    );
    const [n] = await q<{ title: string; body: string }>("select title, body from notifications where user_id = $1 and title like 'Pedido%'", [trainer]);
    assert.equal(n.title, "Pedido de acompanhamento");
    assert.match(n.body, /Rafael Souza: Quero treinar com personal 3x/);
  });
});
