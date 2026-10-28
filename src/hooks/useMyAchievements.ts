"use client";

import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { isDemoMode } from "~/lib/demo-bridge";
import { sortedAchievements, type StudentAchievement } from "~/lib/achievements";

export type MyAchievement = StudentAchievement & { gym_id?: string | null };

/** Conquistas da academia com a data em que o aluno liberou cada uma.
    Fonte única para Perfil e Conquistas: liberadas primeiro. */
export function useMyAchievements() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  return useAsyncQuery<{ list: MyAchievement[]; progress: number }>(
    async () => {
      if (demo) {
        const list = sortedAchievements();
        return { data: { list, progress: Math.round((list.filter((a) => a.earned_at).length / list.length) * 100) }, error: null };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const [achRes, mineRes] = await Promise.all([
        supabase.from("achievements").select("*").or(`gym_id.is.null,gym_id.eq.${profile.gym_id}`),
        supabase.from("student_achievements").select("achievement_id, earned_at").eq("student_id", user.id),
      ]);
      if (achRes.error) return { data: null, error: achRes.error };
      if (mineRes.error) return { data: null, error: mineRes.error };

      const achievements = (achRes.data ?? []) as any[];
      const mine = (mineRes.data ?? []) as any[];
      const earnedMap = new Map(mine.map((m) => [m.achievement_id, m.earned_at]));

      const list: MyAchievement[] = achievements
        .map((a) => ({ ...a, sort: a.gym_id === null ? 0 : 1, earned_at: earnedMap.get(a.id) ?? null }))
        .sort((a, b) => (a.earned_at === null ? 1 : 0) - (b.earned_at === null ? 1 : 0) || a.sort - b.sort);

      const earned = list.filter((a) => a.earned_at).length;
      return { data: { list, progress: list.length ? Math.round((earned / list.length) * 100) : 0 }, error: null };
    },
    [user?.id, profile?.id, demo]
  );
}
