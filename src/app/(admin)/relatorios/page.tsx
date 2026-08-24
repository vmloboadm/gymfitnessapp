"use client";

import { BarChart3, Activity, Users } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { formatVolumeKg, formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoRelatorios } from "~/lib/demo-bridge";
import type { Checkins } from "~/lib/types/models";

/**
 * Relatórios do gym: presença (check-ins de entrada) e volume total movido
 * em 7 dias, números para orientar treinos e horários.
 */
export default function RelatoriosPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{
    checkins: Checkins[];
    volume: number;
    sessions: number;
  }>(
    async () => {
      if (demo) {
        const r = demoRelatorios() as any;
        const total = r.byDay.reduce((a: number, d: any) => a + d.checkins, 0);
        const volume = r.byDay.reduce((a: number, d: any) => a + d.volume, 0);
        return {
          data: {
            checkins: r.byDay.map((d: any) => ({
              id: `c-${d.day}`, gym_id: "1", student_id: "u1", type: "entrada", source: "nfc", checked_at: `2026-08-${d.day.slice(0, 2)}T08:00:00`,
            })),
            volume,
            sessions: total,
          },
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

      const cRes = await supabase
        .from("checkins")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .gte("checked_at", since);
      if (cRes.error) return { data: null, error: cRes.error };

      const wRes = await supabase
        .from("workout_logs")
        .select("weight_kg, reps")
        .gte("date", since)
        .limit(300);
      if (wRes.error) return { data: null, error: wRes.error };

      const checkins = (cRes.data ?? []) as Checkins[];
      const logs = (wRes.data ?? []) as { weight_kg: number; reps: number }[];

      return {
        data: {
          checkins,
          volume: logs.reduce((acc, l) => acc + (l.weight_kg ?? 0) * l.reps, 0),
          sessions: checkins.length,
        },
        error: null,
      };
    },
    [profile?.id, demo]
  );

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Relatórios</h1>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data?.checkins ?? []).length === 0 ? (
          <EmptyState
            title="Sem atividade nos últimos 7 dias"
            description="Check-ins e logs de treino alimentam estes relatórios."
            icon={BarChart3}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatCard label="Check-ins" value={formatNumber(data?.sessions ?? 0)} icon={Activity} context="Entradas (7d)" />
              <StatCard label="Volume" value={formatVolumeKg(data?.volume ?? 0)} icon={BarChart3} context="Carga total" />
              <StatCard label="Dias ativos" value={formatNumber(new Set(data?.checkins.map((c) => c.checked_at.slice(0, 10))).size)} icon={Users} context="Dias c/ atividade" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
