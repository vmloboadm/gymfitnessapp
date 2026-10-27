/**
 * Id estável para uma linha de workout_logs.
 * O mesmo treino + exercício + dia gera o mesmo UUID, então repetir o
 * finalizar (ou a fila offline) não cria histórico duplicado.
 */
export async function stableWorkoutLogId(parts: string[]): Promise<string> {
  const input = parts.join("|");
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hash = await subtle.digest("SHA-1", new TextEncoder().encode(input));
    const b = new Uint8Array(hash).slice(0, 16);
    b[6] = (b[6] & 0x0f) | 0x50;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return globalThis.crypto.randomUUID();
}
