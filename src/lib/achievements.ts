import type { Achievements } from "~/lib/types/models";
import { supabaseBrowser } from "~/lib/supabase/client";

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


/* ---------- Derivação real a partir do banco ---------- */

/**
 * Deriva as conquistas realmente conquistadas a partir de dados do aluno
 * (RLS: cada aluno lê os próprios registros). Retorna o catálogo com
 * earned_at preenchido apenas quando a condição foi atingida de verdade.
 */
export async function loadEarnedAchievements(studentId: string): Promise<StudentAchievement[]> {
  const sb = supabaseBrowser();
  const [catalogRes, mineRes] = await Promise.all([
    sb.from("achievements").select("id, name, description, points, code"),
    sb.from("student_achievements").select("achievement_id, earned_at").eq("student_id", studentId),
  ]);

  const catalog = (catalogRes.data ?? []) as Array<{
    id: string;
    name: string;
    description: string;
    points: number;
    code?: string | null;
  }>;
  const mine = new Map(
    ((mineRes.data ?? []) as Array<{ achievement_id: string; earned_at: string }>).map((a) => [
      a.achievement_id,
      a.earned_at,
    ])
  );

  return catalog
    .map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      points: a.points,
      icon: "",
      earned_at: mine.get(a.id) ?? null,
    }))
    .sort((a, b) => {
      if (!!a.earned_at !== !!b.earned_at) return a.earned_at ? -1 : 1;
      if (a.earned_at && b.earned_at) return a.earned_at < b.earned_at ? 1 : -1;
      return b.points - a.points;
    });
}
