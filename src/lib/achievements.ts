import type { Achievements } from "~/lib/types/models";
import { supabaseBrowser } from "~/lib/supabase/client";
import { calcStreak } from "~/lib/utils/calculations";
import { localDayKey, localDayStartDaysAgoISO, localWeekStartKey } from "~/lib/utils/local-date";

/**
 * Fonte única de conquistas do aluno.
 * O catálogo estático vem SEM earned_at: nada é "ganho" de fabrica.
 * `loadEarnedAchievements` deriva as conquistas reais a partir do banco
 * (workout_logs, checkins, leaderboard) e mescla desbloqueios locais.
 */
export type StudentAchievement = Pick<
  Achievements,
  "id" | "name" | "description" | "points"
> & {
  icon: string;
  earned_at: string | null;
};

export const STUDENT_ACHIEVEMENTS: StudentAchievement[] = [
  { id: "ach-1", name: "Primeiro Treino", description: "Você deu o primeiro passo. O resto é constância.", points: 50, icon: "🎯", earned_at: null },
  { id: "ach-2", name: "Sequência de 3 Dias", description: "3 dias seguidos cumprindo o plano. Corrente iniciada.", points: 80, icon: "🔥", earned_at: null },
  { id: "ach-3", name: "Semana Completa", description: "Meta semanal batida com folga. Ritmo de atleta.", points: 120, icon: "⚡", earned_at: null },
  { id: "ach-4", name: "10 Toneladas", description: "10.000 kg movidos no acumulado do mês.", points: 200, icon: "🏆", earned_at: null },
  { id: "ach-5", name: "Madrugador", description: "Check-in antes das 7h. Quem madruga, cresce.", points: 60, icon: "🌅", earned_at: null },
  { id: "ach-6", name: "Mestre do NFC", description: "10 treinos iniciados por aproximação no aparelho.", points: 150, icon: "📡", earned_at: null },
  { id: "ach-7", name: "Desafiante", description: "Venceu um desafio da semana da comunidade.", points: 250, icon: "🥇", earned_at: null },
  { id: "ach-8", name: "Lenda do Ranking", description: "Alcançou a liga Diamante. Topo absoluto.", points: 500, icon: "👑", earned_at: null },
];

/** Conquistadas primeiro (mais recente no topo), trancadas depois. */
export function sortedAchievements(): StudentAchievement[] {
  return [...STUDENT_ACHIEVEMENTS].sort((a, b) => {
    if (!!a.earned_at !== !!b.earned_at) return a.earned_at ? -1 : 1;
    if (a.earned_at && b.earned_at) return a.earned_at < b.earned_at ? 1 : -1;
    return b.points - a.points;
  });
}

/** Últimas N conquistadas, para o card resumido do Ranking. */
export function recentAchievements(n = 3): StudentAchievement[] {
  return sortedAchievements()
    .filter((a) => a.earned_at)
    .slice(0, n);
}


/* ---------- Overrides em execução (conquistas desbloqueadas no app) ---------- */
const OVERRIDE_KEY = "gymfit_ach_overrides";

function readOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Marca como conquistada AGORA (persistente no dispositivo). */
export function unlockAchievement(id: string): void {
  const o = readOverrides();
  o[id] = new Date().toISOString();
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o));
  } catch {}
}

/** Lista ordenada aplicando overrides locais (sobre o catálogo trancado). */
export function sortedWithOverrides(): StudentAchievement[] {
  const ov = typeof window !== "undefined" ? readOverrides() : {};
  return sortedAchievements().map((a) =>
    !a.earned_at && ov[a.id] ? { ...a, earned_at: ov[a.id] } : a
  );
}

/** Próxima não-conquistada (para o card de comemoração pós-treino). */
export function nextToUnlock(): StudentAchievement | null {
  return sortedWithOverrides().find((a) => !a.earned_at) ?? null;
}

/* ---------- Derivação real a partir do banco ---------- */

type AchSeed = { id: string; earned_at: string };

/**
 * Deriva as conquistas realmente conquistadas a partir de dados do aluno
 * (RLS: cada aluno lê os próprios registros). Retorna o catálogo com
 * earned_at preenchido apenas quando a condição foi atingida de verdade.
 */
export async function loadEarnedAchievements(studentId: string): Promise<StudentAchievement[]> {
  const sb = supabaseBrowser();
  const since90 = localDayStartDaysAgoISO(90);

  const [logsRes, checkinsRes, boardRes] = await Promise.all([
    sb
      .from("workout_logs")
      .select("date, weight_kg, reps")
      .eq("student_id", studentId)
      .gte("date", since90)
      .order("date", { ascending: true })
      .limit(1000),
    sb
      .from("checkins")
      .select("checked_at")
      .eq("student_id", studentId)
      .gte("checked_at", since90)
      .order("checked_at", { ascending: true })
      .limit(500),
    sb
      .from("leaderboard")
      .select("points")
      .eq("student_id", studentId)
      .order("points", { ascending: false })
      .limit(1),
  ]);

  const logs = (logsRes.data ?? []) as Array<{ date: string; weight_kg: number; reps: number }>;
  const checkins = (checkinsRes.data ?? []) as Array<{ checked_at: string }>;
  const topPoints = ((boardRes.data ?? []) as Array<{ points: number }>)[0]?.points ?? 0;

  const seeds: AchSeed[] = [];

  if (logs.length > 0) {
    seeds.push({ id: "ach-1", earned_at: logs[0]!.date });
  }

  const logDates = logs.map((l) => localDayKey(l.date));
  if (calcStreak(logDates) >= 3) {
    seeds.push({ id: "ach-2", earned_at: logDates[logDates.length - 1]! });
  }

  // Semana completa: 5+ dias treinados na mesma semana (segunda a domingo)
  const byWeek = new Map<string, Set<string>>();
  for (const d of logDates) {
    const dt = new Date(d + "T12:00:00");
    const day = dt.getDay();
    const diffToMon = (day + 6) % 7;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - diffToMon);
    const key = localWeekStartKey(monday);
    const set = byWeek.get(key) ?? new Set<string>();
    set.add(d);
    byWeek.set(key, set);
  }
  for (const [monday, set] of byWeek) {
    if (set.size >= 5) {
      seeds.push({ id: "ach-3", earned_at: monday });
      break;
    }
  }

  // 10 Toneladas: 10.000 kg de volume no mês corrente
  const curMonth = new Date().toISOString().slice(0, 7);
  let monthVolume = 0;
  let monthLastDate: string | null = null;
  for (const l of logs) {
    if (l.date.startsWith(curMonth)) {
      monthVolume += (l.weight_kg ?? 0) * (l.reps ?? 0);
      monthLastDate = l.date;
    }
  }
  if (monthVolume >= 10000 && monthLastDate) {
    seeds.push({ id: "ach-4", earned_at: monthLastDate });
  }

  // Madrugador: check-in antes das 7h
  const early = checkins.find((c) => new Date(c.checked_at).getHours() < 7);
  if (early) {
    seeds.push({ id: "ach-5", earned_at: early.checked_at });
  }

  // Lenda do Ranking: 4.000+ pts (liga Diamante)
  if (topPoints >= 4000) {
    seeds.push({ id: "ach-8", earned_at: new Date().toISOString() });
  }

  // ach-6 (NFC) e ach-7 (desafio) não têm fonte de dados confiável: ficam trancadas.

  const earnedMap = new Map(seeds.map((s) => [s.id, s.earned_at]));
  const ov = typeof window !== "undefined" ? readOverrides() : {};

  return STUDENT_ACHIEVEMENTS.map((a) => {
    const earned = earnedMap.get(a.id) ?? ov[a.id] ?? null;
    return { ...a, earned_at: earned };
  }).sort((a, b) => {
    if (!!a.earned_at !== !!b.earned_at) return a.earned_at ? -1 : 1;
    if (a.earned_at && b.earned_at) return a.earned_at < b.earned_at ? 1 : -1;
    return b.points - a.points;
  });
}
