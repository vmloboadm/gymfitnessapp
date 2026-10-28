import test from "node:test";
import assert from "node:assert/strict";
import { resolveTrainingDay } from "../../src/lib/workout/training-day.ts";

const plan = {
  plan: {
    daysSelected: ["Seg", "Ter", "Qua", "Qui", "Sex"],
    dias: [
      { nome: "Seg · A · Peito e Tríceps", foco: "Peito e Tríceps", slot: "A", exercicios: [] },
      { nome: "Ter · B · Costas e Bíceps", foco: "Costas e Bíceps", slot: "B", exercicios: [] },
      { nome: "Qua · C · Pernas e Glúteos", foco: "Pernas e Glúteos", slot: "C", exercicios: [] },
      { nome: "Qui · D · Ombros", foco: "Ombros", slot: "D", exercicios: [] },
      { nome: "Sex · E · Posterior", foco: "Posterior", slot: "E", exercicios: [] },
    ],
  },
};

const seg = (d: string) => ({ date: `${d}T12:00:00-03:00` });

test("segunda programada mostra o treino A", () => {
  const r = resolveTrainingDay({ plan, today: new Date("2026-10-26T12:00:00-03:00"), logs: [] });
  assert.equal(r.status, "scheduled");
  assert.equal(r.dayIdx, 0);
  assert.equal(r.slot, "A");
  assert.equal(r.scheduledWeekdays.join(","), "Seg,Ter,Qua,Qui,Sex");
});

test("domingo fora dos dias é descanso, não falta", () => {
  const logs = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"].map(seg);
  const r = resolveTrainingDay({ plan, today: new Date("2026-11-01T12:00:00-03:00"), logs });
  assert.equal(r.status, "rest");
  assert.equal(r.day, null);
  assert.equal(r.missed, null);
});

test("terça sem o treino de segunda mostra segunda como pendente", () => {
  const r = resolveTrainingDay({ plan, today: new Date("2026-10-27T12:00:00-03:00"), logs: [] });
  assert.equal(r.status, "scheduled");
  assert.equal(r.dayIdx, 1);
  assert.equal(r.slot, "B");
  assert.equal(r.missed?.weekday, "Seg");
  assert.equal(r.missed?.slot, "A");
  assert.equal(r.missed?.daysAgo, 1);
});

test("terça com o treino de segunda feito não tem pendência", () => {
  const r = resolveTrainingDay({ plan, today: new Date("2026-10-27T12:00:00-03:00"), logs: [seg("2026-10-26")] });
  assert.equal(r.missed, null);
});

test("plano sem nome de dia segue a rotação nos dias marcados", () => {
  const generic = {
    plan: {
      daysSelected: ["Seg", "Qua", "Sex"],
      dias: [
        { nome: "Treino A", foco: "A", slot: "A", exercicios: [] },
        { nome: "Treino B", foco: "B", slot: "B", exercicios: [] },
        { nome: "Treino C", foco: "C", slot: "C", exercicios: [] },
      ],
    },
  };
  // nada feito ainda: começa pelo A, não pelo "B de quarta"
  const r0 = resolveTrainingDay({ plan: generic, today: new Date("2026-10-28T12:00:00-03:00"), logs: [] });
  assert.equal(r0.status, "scheduled");
  assert.equal(r0.slot, "A");
  // fez A na segunda: quarta é B
  const r = resolveTrainingDay({
    plan: generic,
    today: new Date("2026-10-28T12:00:00-03:00"),
    logs: [],
    slotChecks: [{ slot: "A", checked_at: "2026-10-26T12:00:00-03:00" }],
  });
  assert.equal(r.dayIdx, 1);
  assert.equal(r.slot, "B");
  assert.equal(r.missed, null);
});

test("dia de descanso sugere o próximo da rotação", () => {
  const generic = {
    plan: {
      daysSelected: ["Seg", "Qua", "Sex"],
      dias: [
        { nome: "Treino A", foco: "A", slot: "A", exercicios: [] },
        { nome: "Treino B", foco: "B", slot: "B", exercicios: [] },
        { nome: "Treino C", foco: "C", slot: "C", exercicios: [] },
      ],
    },
  };
  const r = resolveTrainingDay({
    plan: generic,
    today: new Date("2026-10-27T12:00:00-03:00"),
    logs: [],
    slotChecks: [{ slot: "B", checked_at: "2026-10-26T12:00:00-03:00" }],
  });
  assert.equal(r.status, "rest");
  assert.equal(r.optionalSlot, "C");
});

test("sem dias fixos a rotação continua no próximo slot", () => {
  const rotation = {
    plan: {
      daysSelected: [],
      dias: [
        { nome: "Treino A", foco: "A", slot: "A", exercicios: [] },
        { nome: "Treino B", foco: "B", slot: "B", exercicios: [] },
      ],
    },
  };
  const r = resolveTrainingDay({
    plan: rotation,
    today: new Date("2026-10-27T12:00:00-03:00"),
    logs: [],
    slotChecks: [{ slot: "A", checked_at: "2026-10-26T12:00:00-03:00" }],
  });
  assert.equal(r.status, "scheduled");
  assert.equal(r.dayIdx, 1);
  assert.equal(r.slot, "B");
});

test("available_days é fallback quando o plano não tem daysSelected", () => {
  const generic = {
    plan: {
      daysSelected: [],
      dias: [
        { nome: "Treino A", foco: "A", slot: "A", exercicios: [] },
        { nome: "Treino B", foco: "B", slot: "B", exercicios: [] },
      ],
    },
  };
  const r = resolveTrainingDay({
    plan: generic,
    today: new Date("2026-10-28T12:00:00-03:00"),
    logs: [],
    fallbackDays: ["Seg", "Qua"],
    slotChecks: [{ slot: "A", checked_at: "2026-10-26T12:00:00-03:00" }],
  });
  assert.equal(r.status, "scheduled");
  assert.equal(r.dayIdx, 1);
  assert.equal(r.slot, "B");
});

test("daysSelected manda mesmo quando os dias têm nome de todos os dias", () => {
  const partial = {
    plan: {
      daysSelected: ["Seg", "Qua", "Sex"],
      dias: [
        { nome: "Seg · A · Peito", foco: "Peito", slot: "A", exercicios: [] },
        { nome: "Ter · B · Costas", foco: "Costas", slot: "B", exercicios: [] },
        { nome: "Qua · C · Pernas", foco: "Pernas", slot: "C", exercicios: [] },
        { nome: "Qui · D · Ombros", foco: "Ombros", slot: "D", exercicios: [] },
        { nome: "Sex · E · Posterior", foco: "Posterior", slot: "E", exercicios: [] },
      ],
    },
  };
  const r = resolveTrainingDay({ plan: partial, today: new Date("2026-10-27T12:00:00-03:00"), logs: [] });
  assert.equal(r.status, "rest");
  assert.equal(r.day, null);
  assert.equal(r.optionalSlot, "C");
});

test("não cobra falta de antes do plano ser atribuído", () => {
  const novo = { ...plan, created_at: "2026-10-27T08:00:00-03:00" };
  const r = resolveTrainingDay({ plan: novo, today: new Date("2026-10-27T12:00:00-03:00"), logs: [] });
  assert.equal(r.status, "scheduled");
  assert.equal(r.missed, null);
});
