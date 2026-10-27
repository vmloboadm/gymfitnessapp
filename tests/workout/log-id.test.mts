import test from "node:test";
import assert from "node:assert/strict";
import { stableWorkoutLogId } from "../../src/lib/workout/log-id.ts";

test("mesmo treino e exercício geram sempre o mesmo id", async () => {
  const a = await stableWorkoutLogId(["sessao-1", "aluno-1", "exercicio-1", "2026-10-27"]);
  const b = await stableWorkoutLogId(["sessao-1", "aluno-1", "exercicio-1", "2026-10-27"]);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("exercícios diferentes no mesmo treino geram ids diferentes", async () => {
  const a = await stableWorkoutLogId(["sessao-1", "aluno-1", "exercicio-1", "2026-10-27"]);
  const b = await stableWorkoutLogId(["sessao-1", "aluno-1", "exercicio-2", "2026-10-27"]);
  assert.notEqual(a, b);
});
