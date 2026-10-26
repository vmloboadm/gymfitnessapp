/**
 * Data local da academia (America/Sao_Paulo).
 *
 * O banco guarda `timestamptz` em UTC. Toda contagem por "dia" precisa usar
 * o dia de São Paulo, não o dia UTC: um treino às 22h de segunda ainda é
 * segunda para o aluno, mas já é terça em UTC.
 *
 * `localDayKey` aceita ISO completo (`2026-10-26T01:00:00Z`) ou uma chave
 * já pronta (`2026-10-26`). Nesse segundo caso devolve a própria chave, para
 * funções como `calcStreak` receberem as duas formas sem perder o dia.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localDayKey(value: string | Date): string {
  if (typeof value === "string" && DAY_KEY_RE.test(value)) return value;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}

/** Início do dia local, como ISO UTC. O Brasil não tem mais horário de verão. */
export function localDayStartISO(value: Date = new Date()): string {
  const key = localDayKey(value);
  if (!key) return new Date(value).toISOString();
  return new Date(`${key}T00:00:00-03:00`).toISOString();
}

/** Início do dia local de N dias atrás, como ISO UTC. */
export function localDayStartDaysAgoISO(days: number): string {
  return localDayStartISO(new Date(Date.now() - days * 86_400_000));
}

/** Chave do dia local de N dias atrás. */
export function localDayKeyDaysAgo(days: number): string {
  return localDayKey(new Date(Date.now() - days * 86_400_000));
}

/** Segunda-feira da semana local, como chave YYYY-MM-DD. */
export function localWeekStartKey(value: Date = new Date()): string {
  const d = new Date(value);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDayKey(d);
}
