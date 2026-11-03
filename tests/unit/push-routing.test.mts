import test from "node:test";
import assert from "node:assert/strict";
import { pushAllowed, routePush } from "~/lib/push-routing";

/** Cada aviso do sininho vira push na categoria e tela certas. */

test("curtida, comentário, conquista e recorde abrem o feed (social)", () => {
  for (const t of ["Curtiram sua publicação", "Comentaram sua publicação", "Conquista liberada: Raio de 3 dias", "Novo recorde: Supino"]) {
    const r = routePush(t);
    assert.equal(r.category, "social", t);
    assert.equal(r.path, "/feed", t);
  }
});

test("curtidas se agrupam numa notificação só (mesma tag)", () => {
  assert.equal(routePush("Curtiram sua publicação").tag, routePush("Curtiram sua publicação").tag);
  assert.notEqual(routePush("Curtiram sua publicação").tag, routePush("Comentaram sua publicação").tag);
});

test("treino novo abre a aba Treino", () => {
  assert.deepEqual(routePush("Novo treino liberado"), { category: "workouts", path: "/treino", tag: "workout" });
});

test("aviso desconhecido cai no sininho como lembrete", () => {
  assert.equal(routePush("Qualquer coisa").path, "/notificacoes");
  assert.equal(routePush("Qualquer coisa").category, "reminders");
});

test("preferência: sem registro manda; desligado não manda", () => {
  assert.equal(pushAllowed("social", null), true);
  assert.equal(pushAllowed("social", { push_social: null }), true);
  assert.equal(pushAllowed("social", { push_social: false }), false);
  assert.equal(pushAllowed("workouts", { push_social: false }), true);
});

test("equipe: 'Treino inicial aplicado' abre a lista de alunos", () => {
  assert.equal(routePush("Treino inicial aplicado").path, "/personal/alunos");
});
