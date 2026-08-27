"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Award, Lock } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { cn } from "~/lib/utils";
import { formatDate } from "~/lib/utils/format";
import { isDemoMode } from "~/lib/demo-bridge";
import { sortedAchievements, type StudentAchievement } from "~/lib/achievements";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";

type Ach = StudentAchievement & { gym_id?: string | null };

const DEMO_ACHIEVEMENTS = sortedAchievements();

export default function ConquistasPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{ list: Ach[]; progress: number }>(
    async () => {
      if (demo) {
        return { data: { list: DEMO_ACHIEVEMENTS, progress: Math.round((DEMO_ACHIEVEMENTS.filter((a) => a.earned_at).length / DEMO_ACHIEVEMENTS.length) * 100) }, error: null };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const achRes = await supabase.from("achievements").select("*").or(`gym_id.is.null,gym_id.eq.${profile.gym_id}`);
      if (achRes.error) return { data: null, error: achRes.error };

      const mineRes = await supabase.from("student_achievements").select("achievement_id, earned_at").eq("student_id", user.id);
      if (mineRes.error) return { data: null, error: mineRes.error };

      const achievements = (achRes.data ?? []) as any[];
      const mine = (mineRes.data ?? []) as any[];
      const earnedMap = new Map(mine.map((m) => [m.achievement_id, m.earned_at]));

      const list: Ach[] = achievements
        .map((a) => ({ ...a, sort: a.gym_id === null ? 0 : 1, earned_at: earnedMap.get(a.id) ?? null }))
        .sort((a, b) => (a.earned_at === null ? 1 : 0) - (b.earned_at === null ? 1 : 0) || a.sort - b.sort);

      return { data: { list, progress: achievements.length ? Math.round((mine.length / achievements.length) * 100) : 0 }, error: null };
    },
    [user?.id, profile?.id, demo]
  );

  const earnedCount = useMemo(() => data?.list.filter((a) => a.earned_at).length ?? 0, [data?.list]);

  if (loading) {
    return (
      <>
        <TopBar title="Conquistas" subtitle="Carregando..." />
        <div className="space-y-6 p-4">
          <div className="h-20 bg-card/40 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-card/40 rounded-xl" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Conquistas" />
        <div className="space-y-6 p-4">
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-destructive">{error}</p>
            <button onClick={refetch} className="mt-2 text-sm text-brand underline">Tentar novamente</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Conquistas" subtitle={`${earnedCount}/${data?.list.length ?? 0} liberadas`} />
      <div className="space-y-6 p-4">
        {/* Cabeçalho com progresso geral */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="gf-card gf-glass"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="gf-section">Suas conquistas</p>
              <p className="mt-1 gf-hero-num text-lg">{data?.progress ?? 0}% completo</p>
              <p className="gf-card-text mt-0.5">
                {earnedCount} de {data?.list.length ?? 0} liberadas nesta academia
              </p>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand/15"><FitnessIcon glyph="chest" size={28} /></span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-card/60">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-warning"
              initial={{ width: 0 }}
              animate={{ width: `${data?.progress ?? 0}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {!data?.list.length ? (
          <div className="text-center py-12">
            <Award className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold text-foreground">Nenhuma conquista</h2>
            <p className="mt-2 gf-card-text">As conquistas globais ainda não foram liberadas nesta academia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.list.map((a, i) => {
              const earned = !!a.earned_at;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 50, 350) }}
                  className={cn(
                    "rounded-2xl border p-4 text-center",
                    earned ? "border-brand/30 bg-brand-soft/20" : "border-border bg-card/30 opacity-55"
                  )}
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-card/70 text-2xl">
                    {earned ? (
                    <FitnessIcon glyph={fitnessForName(a.name)} size={26} />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  </span>
                  <p className="mt-2 truncate text-[13px] font-bold text-foreground">{a.name}</p>
                  <p className="mt-0.5 line-clamp-2 min-h-[28px] text-[11px] leading-snug text-muted-foreground">{a.description}</p>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className={cn("gf-hero-num text-xs", earned ? "text-brand" : "text-muted-foreground")}>+{a.points} pts</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{earned ? formatDate(a.earned_at!) : "Trancada"}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
