import test from "node:test";
import assert from "node:assert/strict";
import { actionFor } from "~/lib/notif-action";

/** Cada aviso mostra uma ação clara e leva para a tela certa. */

test("novo treino leva direto ao treino", () => {
  assert.deepEqual(actionFor("Novo treino liberado", "/"), { label: "Ver meu treino", href: "/treino?start=1" });
});

test("sequência e meta puxam para o check-in", () => {
  assert.equal(actionFor("Sequência em risco!", "/").href, "/checkin");
  assert.equal(actionFor("Meta da semana batida", "/").href, "/checkin");
});

test("aviso sem regra usa o destino padrão da tela", () => {
  assert.deepEqual(actionFor("Algo novo", "/progresso"), { label: "Abrir", href: "/progresso" });
});
