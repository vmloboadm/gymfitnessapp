import test from "node:test";
import assert from "node:assert/strict";
import { enqueueOffline, isNetworkError, offlineQueueCount } from "~/lib/offline-queue";

/**
 * Fila offline: o que o aluno salva sem internet. Regra central: a mesma
 * linha (mesmo id) nunca entra duas vezes — é o que evita treino duplicado.
 */

const queue = () => JSON.parse(localStorage.getItem("gf_offline_queue") ?? "[]") as Array<{ table: string; data: { id: string } }>;

test.beforeEach(() => localStorage.clear());

test("enfileira com id gerado quando a linha não tem id", () => {
  assert.equal(enqueueOffline("workout_logs", { reps: 10 }), true);
  const [item] = queue();
  assert.equal(item.table, "workout_logs");
  assert.match(item.data.id, /^[0-9a-f-]{36}$/);
});

test("mesma linha (mesmo id) não entra duas vezes", () => {
  enqueueOffline("workout_logs", { id: "log-1", reps: 10 });
  enqueueOffline("workout_logs", { id: "log-1", reps: 10 });
  assert.equal(offlineQueueCount(), 1);
});

test("mesmo id em tabelas diferentes são itens diferentes", () => {
  enqueueOffline("workout_logs", { id: "x" });
  enqueueOffline("checkins", { id: "x" });
  assert.equal(offlineQueueCount(), 2);
});

test("fila corrompida é tratada como vazia", () => {
  localStorage.setItem("gf_offline_queue", "lixo");
  assert.equal(offlineQueueCount(), 0);
  assert.equal(enqueueOffline("checkins", { id: "c1" }), true);
  assert.equal(offlineQueueCount(), 1);
});

test("reconhece erro de rede do iPhone e do Android", () => {
  assert.equal(isNetworkError(new TypeError("Load failed")), true);
  assert.equal(isNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkError(new Error("duplicate key value")), false);
});
