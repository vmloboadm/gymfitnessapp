/** IMC = peso (kg) / altura² (m). */
export function calcBmi(weightKg: number, heightM: number): number {
  if (heightM <= 0) return 0;
  return weightKg / (heightM * heightM);
}

/** Volume de uma série em kg. */
export function setVolume(weightKg: number, reps: number): number {
  return weightKg * reps;
}

/** Volume total de uma lista de séries. */
export function totalVolume(
  logs: Array<{ weight_kg: number; reps: number }>
): number {
  return logs.reduce((acc, l) => acc + setVolume(l.weight_kg, l.reps), 0);
}

/** Percentual de progresso vs meta (clamp 0..100). */
export function progressPct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

/** Delta % entre dois períodos. Null quando anterior é 0. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Streak de dias consecutivos de treino (lista de datas pt-BR). */
export function calcStreak(days: string[]): number {
  if (days.length === 0) return 0;
  const unique = [...new Set(days.map((d) => d.slice(0, 10)))].sort();
  let streak = 1;
  let cursor = new Date(unique[unique.length - 1] + "T12:00:00");
  for (let i = unique.length - 2; i >= 0; i--) {
    const prev = new Date(unique[i] + "T12:00:00");
    const diffDays = Math.round((cursor.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
      cursor = prev;
    } else if (diffDays > 1) {
      break;
    }
  }
  return streak;
}

/** "Segunda-feira" de uma data pt-BR. */
export function weekdayName(date: string | Date = new Date()): string {
  return new Date(date).toLocaleDateString("pt-BR", { weekday: "long" });
}

/** Próxima segunda-feira às 00:00 (base do ranking semanal). */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Mesma coisa para o mês corrente (YYYY-MM). */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}