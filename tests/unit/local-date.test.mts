import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  localDayKey,
  localDayKeyDaysAgo,
  localDayStartDaysAgoISO,
  localDayStartISO,
} from "~/lib/utils/local-date";

/** O dia do aluno é o de São Paulo, nunca o UTC do banco. */

test("22h de segunda em São Paulo ainda é segunda (já é terça em UTC)", () => {
  assert.equal(localDayKey("2026-10-27T01:00:00Z"), "2026-10-26");
});

test("chave pronta passa direto", () => {
  assert.equal(localDayKey("2026-10-26"), "2026-10-26");
});

test("data inválida vira string vazia em vez de quebrar", () => {
  assert.equal(localDayKey("não é data"), "");
});

test("início do dia local é 03:00 UTC (Brasil sem horário de verão)", () => {
  assert.equal(localDayStartISO(new Date("2026-11-04T13:00:00Z")), "2026-11-04T03:00:00.000Z");
  // 01h UTC do dia 05 ainda é dia 04 em São Paulo
  assert.equal(localDayStartISO(new Date("2026-11-05T01:00:00Z")), "2026-11-04T03:00:00.000Z");
});

test("N dias atrás usa o relógio e o fuso de São Paulo", () => {
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-04T02:00:00Z") }); // 03/11 23h SP
  try {
    assert.equal(localDayKeyDaysAgo(0), "2026-11-03");
    assert.equal(localDayKeyDaysAgo(1), "2026-11-02");
    assert.equal(localDayStartDaysAgoISO(7), "2026-10-27T03:00:00.000Z");
  } finally {
    mock.timers.reset();
  }
});
