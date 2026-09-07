/**
 * Senha do dia — desbloqueio do treino sem QR/NFC.
 * Determinística: mesmos 4 dígitos para academia+dia, sem banco de dados.
 * O gestor vê em /personal/dashboard; o aluno digita em /treino.
 * Troca todo dia à meia-noite automaticamente.
 */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Senha de 4 dígitos da academia para o dia. */
export function getDayPassword(gymId: string, d: Date = new Date()): string {
  const n = hashStr(`${gymId}|${dayKey(d)}|gymfitness`) % 9000;
  return String(1000 + n);
}

/** Confere a senha digitada (aceita com/sem espaços). */
export function checkDayPassword(gymId: string, input: string, d: Date = new Date()): boolean {
  return input.replace(/\D/g, "") === getDayPassword(gymId, d);
}
