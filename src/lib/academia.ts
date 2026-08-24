/**
 * Camada de dados compartilhada para dashboard/tickers (pro-frontend-standards §7).
 * Centraliza constantes e fetches normalizados, rotas de API e páginas
 * consomem este módulo, sem fetch duplicado.
 */

export const API_TIMEOUT_MS = 15_000;

/** Quantos dias de janela para os resumos de frequência/volume. */
export const WEEK_DAYS = 7;

export function withTimeout<T>(promise: Promise<T>, ms = API_TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return promise.finally(() => clearTimeout(timer));
}

export type FrequencySeries = {
  days: Array<{ day: string; label: string; checkins: number }>;
  today: number;
  avgWeek: number;
  deltaPct: number | null;
};

export type OccupancySnapshot = {
  total: number;
  inUse: number;
  free: number;
  byCategory: Array<{ category: string; count: number }>;
};

/** Normaliza a saída do banco para um contrato limpo de frequência. */
export function buildFrequencySeries(
  checkins: Array<{ checked_at: string }>,
  days = WEEK_DAYS
): FrequencySeries {
  const buckets: Array<{ day: string; label: string; checkins: number }> = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const idx = new Map<string, number>();
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const key = date.toISOString().slice(0, 10);
    idx.set(key, buckets.length);
    buckets.push({
      day: key,
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      checkins: 0,
    });
  }
  for (const c of checkins) {
    const key = (c.checked_at ?? "").slice(0, 10);
    const i = idx.get(key);
    if (i != null) buckets[i].checkins += 1;
  }

  const today = buckets[buckets.length - 1]?.checkins ?? 0;
  const previousDays = buckets.slice(0, -1);
  const avgWeek = previousDays.length
    ? previousDays.reduce((acc, b) => acc + b.checkins, 0) / previousDays.length
    : 0;
  const deltaPct = avgWeek > 0 ? ((today - avgWeek) / avgWeek) * 100 : null;

  return { days: buckets, today, avgWeek, deltaPct };
}

/**
 * Fonte única do "Treino de Hoje", Dashboard e aba Treino leem daqui,
 * garantindo que o nome exibido seja sempre o mesmo nos dois lugares.
 */
export function todayWorkoutTitle(programName: string | null | undefined): string {
  return programName?.trim() || "Força & Hipertrofia";
}
