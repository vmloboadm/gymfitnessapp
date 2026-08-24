"use client";

import { useMemo } from "react";
import { Scale, Ruler, Percent, Activity, TrendingDown, TrendingUp } from "lucide-react";
import { PesoLineChart } from "~/components/charts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { GlossaryTip } from "~/components/common/Glossary";
import { Badge } from "~/components/ui/badge";
import { calcBmi, deltaPct } from "~/lib/utils/calculations";
import { formatDate, formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoMetricsData } from "~/lib/demo-bridge";
import type { BodyMetrics } from "~/lib/types/models";

const BMI_RANGES = [
  { min: 0, max: 18.5, label: "Abaixo do peso", tone: "warning" },
  { min: 18.5, max: 25, label: "Peso normal", tone: "success" },
  { min: 25, max: 30, label: "Sobrepeso", tone: "warning" },
  { min: 30, max: Infinity, label: "Obesidade", tone: "danger" },
] as const;

/* Régua de IMC: largura de cada faixa na barra (escala 15–40) */
const BMI_SCALE_MIN = 15;
const BMI_SCALE_MAX = 40;
const BMI_SEGMENTS = [
  { from: 15, to: 18.5, className: "bg-warning/60" },
  { from: 18.5, to: 25, className: "bg-success/70" },
  { from: 25, to: 30, className: "bg-warning/60" },
  { from: 30, to: 40, className: "bg-destructive/60" },
];

/**
 * Métricas corporais do aluno: última medição, evolução de peso,
 * IMC em régua visual e composição corporal.
 */
export default function MetricasPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery(
    async () => {
      if (demo) {
        const { metrics } = demoMetricsData();
        return { data: { latest: metrics[0], history: metrics, previous: metrics[1] ?? null }, error: null };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const metricsRes = await supabase
        .from("body_metrics")
        .select("*")
        .eq("student_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(10);
      if (metricsRes.error) return { data: null, error: metricsRes.error };

      const prevRes = await supabase
        .from("body_metrics")
        .select("*")
        .eq("student_id", user.id)
        .order("recorded_at", { ascending: false })
        .range(10, 12);

      const metrics = (metricsRes.data ?? []) as BodyMetrics[];
      return {
        data: {
          latest: metrics[0] ?? null,
          history: metrics,
          previous: (prevRes.data as BodyMetrics[] | null)?.[0] ?? null,
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  const bmi = useMemo(() => {
    const latest = data?.latest;
    if (!latest) return null;
    if (latest.bmi != null) return latest.bmi;
    if (latest.weight_kg != null && latest.height_m) return calcBmi(latest.weight_kg, latest.height_m);
    return null;
  }, [data?.latest]);

  const range = bmi != null ? BMI_RANGES.find((r) => bmi < r.max) : undefined;
  const weightDelta = deltaPct(data?.latest?.weight_kg ?? 0, data?.previous?.weight_kg ?? 0);
  const bfDelta = useMemo(
    () => deltaPct(data?.latest?.body_fat_pct ?? 0, data?.previous?.body_fat_pct ?? 0),
    [data?.latest, data?.previous]
  );
  const muscleDelta = useMemo(
    () => deltaPct(data?.latest?.muscle_kg ?? 0, data?.previous?.muscle_kg ?? 0),
    [data?.latest, data?.previous]
  );

  // Série de evolução do peso (mais antigo → mais recente)
  const weightSeries = useMemo(() => {
    const m = (data?.history ?? []) as BodyMetrics[];
    return [...m]
      .sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1))
      .map((x) => ({
        label: formatDate(new Date(x.recorded_at).toISOString().slice(0, 10)).slice(0, 5),
        peso: x.weight_kg ?? 0,
      }));
  }, [data?.history]);

  // Posição do marcador na régua de IMC (0–100%)
  const bmiPos =
    bmi != null
      ? Math.max(0, Math.min(100, ((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100))
      : null;

  if (loading) {
    return (
      <>
        <TopBar title="Métricas" subtitle="Corpo e composição" />
        <div className="space-y-6 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-24 rounded-xl bg-card/40" />
            <div className="h-24 rounded-xl bg-card/40" />
            <div className="h-24 rounded-xl bg-card/40" />
          </div>
          <SkeletonList rows={2} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Métricas" />
        <div className="space-y-6 p-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  if (!data?.latest) {
    return (
      <>
        <TopBar title="Métricas" />
        <div className="space-y-6 p-4">
          <EmptyState
            title="Nenhuma medição registrada"
            description="Sua primeira medição é salva no onboarding (passo de métricas corporais)."
            icon={Scale}
          />
        </div>
      </>
    );
  }

  const latest = data.latest;

  return (
    <>
      <TopBar title="Métricas" subtitle={data.history.length ? `Atualizado em ${formatDate(latest.recorded_at)}` : undefined} />
      <div className="space-y-6 p-4">
        <div className="gf-rise grid grid-cols-3 gap-2">
          <StatCard
            label="Peso"
            value={latest.weight_kg != null ? `${formatNumber(latest.weight_kg)} kg` : "-"}
            delta={weightDelta}
            icon={Scale}
          />
          <StatCard
            label="Altura"
            value={latest.height_m ? `${formatNumber(latest.height_m * 100)} cm` : "-"}
            icon={Ruler}
          />
          <StatCard
            label="Gordura"
            value={latest.body_fat_pct != null ? `${formatNumber(latest.body_fat_pct)}%` : "-"}
            delta={bfDelta}
            icon={Percent}
          />
        </div>

        {/* Evolução do peso, tendência real das medições */}
        {weightSeries.length >= 2 ? (
          <div className="gf-rise rounded-xl border border-border bg-card/50 p-4" style={{ animationDelay: "60ms" }}>
            <p className="mb-2 gf-section">Evolução do peso</p>
            <div className="h-36">
              <PesoLineChart data={weightSeries} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {weightSeries.length} medições registradas. O que importa é a tendência das semanas, não o número de um dia.
            </p>
          </div>
        ) : null}

        {/* IMC com régua segmentada + explicação leiga */}
        {bmi != null ? (
          <div className="gf-rise rounded-xl border border-border bg-card/40 p-4" style={{ animationDelay: "120ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">IMC</p>
              <Badge variant={range?.tone === "danger" ? "danger" : range?.tone === "warning" ? "warning" : "success"}>
                {formatNumber(bmi)} · {range?.label}
              </Badge>
            </div>

            <div className="relative">
              <div className="flex h-2.5 overflow-hidden rounded-full">
                {BMI_SEGMENTS.map((s) => (
                  <span
                    key={s.from}
                    className={s.className}
                    style={{ width: `${((s.to - s.from) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100}%` }}
                  />
                ))}
              </div>
              {bmiPos != null ? (
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-md transition-all duration-500"
                  style={{ left: `${bmiPos}%` }}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
              <span>15</span>
              <span>18,5</span>
              <span>25</span>
              <span>30</span>
              <span>40</span>
            </div>

            <GlossaryTip term="IMC?" className="mt-3">
              IMC compara seu peso com sua altura pra dar uma noção geral da saúde do corpo. Ele não enxerga músculo -
              quem treina pesado pode ter IMC alto e estar ótimo. Use como referência junto com o % de gordura.
            </GlossaryTip>
          </div>
        ) : null}

        {/* Composição corporal, massa magra e cintura com variação */}
        <div className="gf-rise space-y-2" style={{ animationDelay: "180ms" }}>
          {latest.muscle_kg != null ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                <Activity className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Massa magra</p>
                <p className="text-xs text-muted-foreground">{formatNumber(latest.muscle_kg)} kg de músculo</p>
              </div>
              {muscleDelta != null ? (
                <span className={cnDelta(muscleDelta)}>
                  {muscleDelta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {formatNumber(Math.abs(muscleDelta))}%
                </span>
              ) : null}
            </div>
          ) : null}

          {latest.waist_cm != null ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                <Ruler className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Cintura</p>
                <p className="text-xs text-muted-foreground">{formatNumber(latest.waist_cm)} cm, cintura descendo é um ótimo sinal</p>
              </div>
            </div>
          ) : null}

          {bfDelta != null && latest.body_fat_pct != null ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                <Percent className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Gordura corporal</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(latest.body_fat_pct)}% ·{" "}
                  {bfDelta < 0 ? "caindo, evolução!" : bfDelta > 0 ? "subiu desde a última medição" : "estável"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Histórico de medições */}
        {(data.history as BodyMetrics[]).length >= 2 ? (
          <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "240ms" }}>
            <p className="gf-section mb-2">Histórico de medições</p>
            <div className="space-y-1.5">
              {(data.history as BodyMetrics[]).slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3.5 py-2.5">
                  <span className="text-sm font-medium text-foreground">{formatDate(m.recorded_at)}</span>
                  <span className="gf-hero-num text-xs text-muted-foreground">
                    {m.weight_kg != null ? `${formatNumber(m.weight_kg)} kg` : "-"}
                    {m.body_fat_pct != null ? ` · ${formatNumber(m.body_fat_pct)}% BF` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function cnDelta(delta: number): string {
  const base = "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums";
  return delta >= 0 ? `${base} bg-success/15 text-success` : `${base} bg-warning/15 text-warning`;
}
