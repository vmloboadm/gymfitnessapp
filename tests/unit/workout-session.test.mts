import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionProgress,
  elapsedSeconds,
  endWorkoutSession,
  formatMMSS,
  readSessionProgress,
  saveSessionProgress,
  sessionPhase,
  startWorkoutSession,
} from "~/lib/workout-session";

/**
 * Sessão de treino guardada no celular: cronômetro, fases e o progresso das
 * séries que precisa sobreviver à navegação (e expirar em 3h).
 */
const H = 3_600_000;
const T0 = Date.parse("2026-11-04T13:00:00Z");

test.beforeEach(() => {
  localStorage.clear();
  mock.timers.enable({ apis: ["Date"], now: T0 });
});
test.afterEach(() => mock.timers.reset());

test("cronômetro: segundos e mm:ss", () => {
  assert.equal(elapsedSeconds(T0, T0 + 125_000), 125);
  assert.equal(elapsedSeconds(T0, T0 - 5_000), 0);
  assert.equal(formatMMSS(125), "02:05");
  assert.equal(formatMMSS(0), "00:00");
});

test("fase: ativa < 2h, alerta a partir de 2h, expirada em 3h", () => {
  assert.equal(sessionPhase(T0, T0 + 1.9 * H), "ativa");
  assert.equal(sessionPhase(T0, T0 + 2 * H), "alerta");
  assert.equal(sessionPhase(T0, T0 + 3 * H), "expirada");
  assert.equal(sessionPhase(T0, T0 - 1000), null);
});

const progress = {
  exercises: [{ id: "supino" }],
  progress: { supino: { sets: [{ reps: "10", weight: "40", done: true }] } },
  currentIdx: 0,
};

test("progresso das séries sobrevive enquanto a sessão está aberta", () => {
  startWorkoutSession(T0);
  saveSessionProgress(progress);
  mock.timers.tick(30 * 60_000);
  const p = readSessionProgress();
  assert.ok(p);
  assert.equal(p.sessionStartedAt, T0);
  assert.deepEqual(p.progress, progress.progress);
});

test("progresso some depois de 3h (sessão órfã)", () => {
  startWorkoutSession(T0);
  saveSessionProgress(progress);
  mock.timers.tick(3 * H + 60_000);
  assert.equal(readSessionProgress(), null);
});

test("sem sessão aberta o progresso salvo não é retomado", () => {
  startWorkoutSession(T0);
  saveSessionProgress(progress);
  endWorkoutSession();
  assert.equal(readSessionProgress(), null);
});

test("limpar progresso apaga o salvo", () => {
  startWorkoutSession(T0);
  saveSessionProgress(progress);
  clearSessionProgress();
  assert.equal(readSessionProgress(), null);
});

test("progresso corrompido no storage não quebra a tela", () => {
  startWorkoutSession(T0);
  localStorage.setItem("gymfit_session_progress_v1", "{isso não é json");
  assert.equal(readSessionProgress(), null);
});
