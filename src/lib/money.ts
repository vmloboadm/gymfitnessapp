/**
 * Dinheiro sempre em CENTAVOS (inteiro) — nunca float. Formato brasileiro.
 * Limite igual ao do banco (personal_offers.price_cents ≤ R$ 100.000).
 */

const MAX_CENTS = 10_000_000;

/** 25000 → "R$ 250,00"; null → "valor a combinar". */
export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "valor a combinar";
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cent = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}R$ ${reais},${cent}`;
}

/** "250", "250,00", "R$ 1.500,50", "99.9" → centavos; inválido → null. */
export function parseBRLToCents(input: string): number | null {
  let s = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s || /[^0-9.,]/.test(s)) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_CENTS) return null;
  return cents;
}
