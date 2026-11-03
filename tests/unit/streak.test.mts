import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { calcScheduledStreak, calcStreak } from "~/lib/utils/calculations";

/**
 * Cálculos de sequência do lado do app. A fonte da verdade é o banco
 * (day_streak, tests/db/streak.test.mts); estes são a reserva quando a
 * chamada ao banco falha. Relógio fixo: quarta 04/11/2026, 10h em São Paulo.
 */
const NOW = Date.parse("2026-11-04T13:00:00Z");

test.beforeEach(() => mock.timers.enable({ apis: ["Date"], now: NOW }));
test.afterEach(() => mock.timers.reset());

test("calcStreak: sem treino é 0", () => {
  assert.equal(calcStreak([]), 0);
});

test("calcStreak: hoje, ontem e anteontem = 3", () => {
  assert.equal(calcStreak(["2026-11-04", "2026-11-03", "2026-11-02"]), 3);
});

test("calcStreak: hoje sem treino ainda conta até ontem", () => {
  assert.equal(calcStreak(["2026-11-03", "2026-11-02"]), 2);
});

test("calcStreak: último treino anteontem zera (chama apagada)", () => {
  assert.equal(calcStreak(["2026-11-02", "2026-11-01"]), 0);
});

test("calcStreak: buraco no meio interrompe", () => {
  assert.equal(calcStreak(["2026-11-04", "2026-11-03", "2026-11-01"]), 2);
});

test("calcStreak: repetidos e horário UTC viram o dia de São Paulo", () => {
  // 04/11 01:00 UTC = 03/11 22:00 em São Paulo
  assert.equal(calcStreak(["2026-11-04T01:00:00Z", "2026-11-03", "2026-11-03", "2026-11-02T15:00:00Z"]), 2);
});

const SEG_QUA_SEX = ["Seg", "Qua", "Sex"];

test("calcScheduledStreak: descanso (terça) não quebra", () => {
  // qua 04 (hoje) + seg 02; sex 30/10 faltou → 2
  assert.equal(calcScheduledStreak(["2026-11-04", "2026-11-02"], SEG_QUA_SEX), 2);
});

test("calcScheduledStreak: fim de semana de descanso não quebra", () => {
  assert.equal(calcScheduledStreak(["2026-11-04", "2026-11-02", "2026-10-30", "2026-10-28"], SEG_QUA_SEX), 4);
});

test("calcScheduledStreak: hoje (dia marcado) ainda sem treino não zera", () => {
  assert.equal(calcScheduledStreak(["2026-11-02", "2026-10-30"], SEG_QUA_SEX), 2);
});

test("calcScheduledStreak: dia marcado perdido quebra", () => {
  // seg 02 faltou
  assert.equal(calcScheduledStreak(["2026-11-04", "2026-10-30"], SEG_QUA_SEX), 1);
});

test("calcScheduledStreak: sem ficha usa a sequência simples", () => {
  assert.equal(calcScheduledStreak(["2026-11-04", "2026-11-03"], []), 2);
});

// Mesma regra de reposição do banco (migration 067), mesmos cenários de
// tests/db/streak.test.mts: semana passada = 26/10 (seg) a 01/11 (dom).
test("calcScheduledStreak: reposição — ficha seg/qua/sex, treinou ter/qui/sex, continua", () => {
  const dias = ["2026-11-03", "2026-11-02", "2026-10-27", "2026-10-29", "2026-10-30"];
  assert.equal(calcScheduledStreak(dias, SEG_QUA_SEX), 5);
});

test("calcScheduledStreak: reposição cobre só uma falta por treino extra", () => {
  const dias = ["2026-11-03", "2026-11-02", "2026-10-27", "2026-10-30"];
  assert.equal(calcScheduledStreak(dias, SEG_QUA_SEX), 4);
});
