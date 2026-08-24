const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

/** R$ 1.234,56 */
export function formatBRL(value: number): string {
  return brl.format(value);
}

/** R$ 12 mil */
export function formatBRLCompact(value: number): string {
  return brlCompact.format(value);
}

/** 1.234,56 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 80 kg */
export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`;
}

/** 8.400 kg (volume) */
export function formatVolumeKg(value: number): string {
  return `${formatNumber(value)} kg`;
}

/** pt-BR data: 16/08/2026 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR");
}

/** pt-BR tempo curto: 18:42 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** pt-BR relativo: "há 5 min" */
export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

/** "+18%" / "-12%" */
export function formatPercent(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** 8 x 12 → "8 × 12" */
export function formatSetsReps(sets: number, reps: string): string {
  return `${sets} × ${reps}`;
}

/** 80 × 8 → "80 kg × 8" */
export function formatLoad(weightKg: number, reps: number): string {
  return `${formatNumber(weightKg)} kg × ${reps}`;
}

/** onboard first char uppercase */
export function cap(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}