"use client";

import { useMemo } from "react";
import { m } from "framer-motion";
import { Award, Lock } from "lucide-react";
import { TopBar } from "~/components/layout/TopBar";
import { cn } from "~/lib/utils";
import { formatDate } from "~/lib/utils/format";
import { useMyAchievements } from "~/hooks/useMyAchievements";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";

export default function ConquistasPage() {
  const { data, loading, error, refetch } = useMyAchievements();

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
        <m.div
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
            <m.div
              className="h-full w-full origin-left rounded-full bg-gradient-to-r from-brand to-warning"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: (data?.progress ?? 0) / 100 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
        </m.div>

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
                <m.div
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
                </m.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
