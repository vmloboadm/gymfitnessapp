import test from "node:test";
import assert from "node:assert/strict";
import { formatBRL, parseBRLToCents } from "~/lib/money";

/** Dinheiro em centavos (inteiro), mostrado no padrão brasileiro. */

test("formata centavos em reais; sem preço = a combinar", () => {
  assert.equal(formatBRL(25000), "R$ 250,00");
  assert.equal(formatBRL(9990), "R$ 99,90");
  assert.equal(formatBRL(150000), "R$ 1.500,00");
  assert.equal(formatBRL(null), "valor a combinar");
});

test("entende o preço do jeito que o personal digita", () => {
  assert.equal(parseBRLToCents("250"), 25000);
  assert.equal(parseBRLToCents("250,00"), 25000);
  assert.equal(parseBRLToCents("R$ 99,90"), 9990);
  assert.equal(parseBRLToCents("1.500"), 150000);
  assert.equal(parseBRLToCents("1.500,50"), 150050);
  assert.equal(parseBRLToCents("99.9"), 9990);
});

test("preço inválido vira null em vez de salvar errado", () => {
  assert.equal(parseBRLToCents("abc"), null);
  assert.equal(parseBRLToCents("-10"), null);
  assert.equal(parseBRLToCents(""), null);
  assert.equal(parseBRLToCents("200000"), null);
});
