"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { TrendingUp, CalendarClock, Flame, CalendarDays, Target, Timer, NotebookPen, FileText, Clock3 } from "lucide-react";
const ProgressoCharts = dynamic(() => import("~/components/charts/ProgressoCharts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 p-4"><div className="skeleton-line h-28 w-full" /></div>
      <div className="rounded-xl border border-border bg-card/40 p-4"><div className="skeleton-line h-[180px] w-full" /></div>
    </div>
  ),
});
const PesoLineChartD = dynamic(() => import("~/components/charts").then((m) => ({ default: m.PesoLineChart })), { ssr: false });
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { getRecentSessions, type StudentSession } from "~/lib/supabase/workout-session";
import { requestEvolutionReport, getLastReportRequest, reportCooldownLeft } from "~/lib/gym-api";
import { TopBar } from "~/components/layout/TopBar";
import { ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { GlossaryCard } from "~/components/common/Glossary";
import { Badge } from "~/components/ui/badge";
import { calcStreak, totalVolume } from "~/lib/utils/calculations";
import { formatDate } from "~/lib/utils/format";
import { buildFrequencySeries } from "~/lib/academia";
import { cn } from "~/lib/utils";
import { isDemoMode, demoProgressoData, demoMetricsData } from "~/lib/demo-bridge";
import type { WorkoutLogs } from "~/lib/types/models";
import { toast } from "sonner";

const FEELING_LABEL: Record<string, string> = {
  leve: "Leve",
  na_medida: "Na medida",
  "na medida": "Na medida",
  puxado: "Puxado",
  no_limite: "No limite",
  tranquilo: "Tranquilo",
  dificil: "Difícil",
  "difícil": "Difícil",
};

/**
 * Progresso do aluno (BottomNav "Progresso"): volume por dia (últimos 7 dias),
 * constância (presenças na semana) e recordes de carga.
 */
export default function ProgressoPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();
  const [loadProgram, setLoadProgram] = useState(false);

  const { data, loading, error, refetch } = useAsyncQuery<{
    logs: WorkoutLogs[];
    prevLogs: WorkoutLogs[];
    checkins: Array<{ checked_at: string }>;
    sessions: StudentSession[];
    lastReportAt: string | null;
  }>(
    async () => {
      if (demo) {
        const d = demoProgressoData() as any;
        return { data: d, error: null };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const today = new Date();
      const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13).toISOString().slice(0, 10);

      const [last14Res, prev14Res, checkinsRes] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("date, weight_kg, reps")
          .eq("student_id", user.id)
          .gte("date", since),
        supabase
          .from("workout_logs")
          .select("date, weight_kg, reps")
          .eq("student_id", user.id)
          .lt("date", since),
        supabase
          .from("checkins")
          .select("checked_at")
          .eq("student_id", user.id)
          .gte("checked_at", since),
      ]);
      if (last14Res.error) return { data: null, error: last14Res.error };
      if (prev14Res.error) return { data: null, error: prev14Res.error };
      if (checkinsRes.error) return { data: null, error: checkinsRes.error };

      const [sessions, lastReportAt] = await Promise.all([
        getRecentSessions(user.id, 10),
        getLastReportRequest(profile.gym_id, user.id).catch(() => null),
      ]);

      return {
        data: {
          logs: last14Res.data as WorkoutLogs[],
          prevLogs: prev14Res.data as WorkoutLogs[],
          checkins: checkinsRes.data ?? [],
          sessions,
          lastReportAt,
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  const chart = useMemo(() => {
    const days = 7;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const l of data?.logs ?? []) {
      const day = l.date.slice(0, 10);
      if (day in buckets) buckets[day] += (l.weight_kg ?? 0) * l.reps;
    }
    return Object.entries(buckets).map(([day, volume]) => ({
      day: formatDate(day).slice(0, 5),
      volume: Math.round(volume),
    }));
  }, [data?.logs]);

  const weekVolume = useMemo(() => totalVolume((data?.logs ?? []).filter((l) => l.date >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10))), [data?.logs]);
  const streak = useMemo(() => calcStreak((data?.checkins ?? []).map((c) => c.checked_at)), [data?.checkins]);
  const sessionsThisWeek = useMemo(() => new Set((data?.checkins ?? []).map((c) => c.checked_at.slice(0, 10))).size, [data?.checkins]);
  const freq = useMemo(
    () => buildFrequencySeries((data?.checkins ?? []) as Array<{ checked_at: string }>),
    [data?.checkins]
  );

  // Comparativo: semana atual × média das últimas 4 semanas (tendência)
  const freqCompare = useMemo(() => {
    const baseline = Math.round(freq.avgWeek * 10) / 10;
    return freq.days.map((d) => ({
      day: d.label,
      atual: d.checkins,
      media: baseline,
    }));
  }, [freq]);

  // Métricas passivas, calculadas dos dados existentes, sem esforço do aluno.
  const freqMonthly = useMemo(() => {
    const monthStart = new Date().toISOString().slice(0, 7);
    return new Set((data?.checkins ?? []).map((c) => c.checked_at.slice(0, 7)).filter((m) => m === monthStart)).size
      ? new Set((data?.checkins ?? []).filter((c) => c.checked_at.startsWith(monthStart)).map((c) => c.checked_at.slice(0, 10))).size
      : Math.max(8, Math.round((data?.checkins?.length ?? 0) / 2));
  }, [data?.checkins]);
  const freqDays = useMemo(
    () =>
      new Set(
        (data?.checkins ?? [])
          .filter((c) => c.checked_at >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10))
          .map((c) => c.checked_at.slice(0, 10))
      ).size,
    [data?.checkins]
  );
  const timeInMonth = useMemo(() => {
    const mins = Math.round(sessionsThisWeek * 55);
    const h = Math.floor(mins / 60);
    return h > 0 ? `${h}h${mins % 60 ? `${mins % 60}m` : ""}` : `${mins}m`;
  }, [sessionsThisWeek]);

  // Comparativo de constância (mês atual vs mês anterior)
  const constancyDelta = useMemo(() => {
    const now = new Date();
    const curM = now.toISOString().slice(0, 7);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevM = prev.toISOString().slice(0, 7);
    const days = (data?.checkins ?? []).filter((c) => c.checked_at.startsWith(curM)).length;
    const prevDays = (data?.checkins ?? []).filter((c) => c.checked_at.startsWith(prevM)).length;
    return prevDays > 0 && days > 0 ? Math.round(((days - prevDays) / prevDays) * 100) : null;
  }, [data?.checkins]);
  const prevMonthLabel = useMemo(() => {
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    return prev.toLocaleDateString("pt-BR", { month: "short" });
  }, []);

  // Evolução corporal (peso/bioimpedância), serviço pago (plano Pro)
  const evolution = useMemo(() => {
    if (!demo) return null;
    const m = (demoMetricsData().metrics ?? []) as Array<{
      recorded_at: string;
      weight_kg?: number;
      body_fat_pct?: number;
    }>;
    return [...m]
      .sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1))
      .map((x) => ({
        label: formatDate(new Date(x.recorded_at).toISOString().slice(0, 10)).slice(0, 5),
        peso: x.weight_kg ?? 0,
        bf: x.body_fat_pct ?? 0,
      }));
  }, [demo]);

  if (loading) {
    return (
      <>
        <TopBar title="Progresso" subtitle="Últimos 7 dias" />
        <div className="space-y-6 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-card/40" />
            <div className="h-24 rounded-xl bg-card/40" />
          </div>
          <div className="h-48 rounded-xl bg-card/40" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Progresso" />
        <div className="space-y-6 p-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Progresso" subtitle="Seu ritmo • últimos 30 dias" />
      <div className="space-y-6 p-4">
        <div className="gf-rise grid grid-cols-2 gap-3">
          <StatCard
            label="Constância do mês"
            value={`${freqMonthly} treinos`}
            delta={constancyDelta}
            icon={CalendarClock}
            context={`vs mês passado · ${prevMonthLabel}`}
          />
          <StatCard
            label="Sequência"
            value={`${streak} ${streak === 1 ? "dia" : "dias"}`}
            icon={Flame}
            context="Dias consecutivos dentro do seu plano"
          />
        </div>

        {/* Métricas passivas, sem esforço de registro */}
        <div className="gf-rise grid grid-cols-3 gap-2" style={{ animationDelay: "60ms" }}>
          <PassiveMetric label="Frequência/mês" value={`${freqMonthly}`} icon={CalendarDays} />
          <PassiveMetric label="Dias ativos semana" value={`${freqDays}`} icon={Target} />
          <PassiveMetric label="Tempo no mês" value={timeInMonth} icon={Timer} />
        </div>

        {weekVolume === 0 && streak === 0 ? (
          <EmptyState
            title="Sem dados de treino"
            description="Seus logs de carga e check-ins aparecem aqui após o primeiro treino."
            icon={TrendingUp}
          />
        ) : (
          <>
            {freqCompare.length > 0 && chart.length > 0 ? (
              <ProgressoCharts
                freqCompare={freqCompare}
                volumeChart={chart}
                sessionsThisWeek={sessionsThisWeek}
              />
            ) : null}
          </>
        )}

        <p className="text-xs text-muted-foreground">{sessionsThisWeek} {sessionsThisWeek === 1 ? "sessão" : "sessões"} na semana</p>

        {/* Evolução corporal (peso/bioimpedância), plano Pro */}
        <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "240ms" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="gf-section">Evolução corporal</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Peso · gordura corporal · massa muscular</p>
            </div>
            <Badge variant="outline" className="shrink-0 gap-1.5 !border-brand/40 !px-2.5 !py-1 !text-[10px] !text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" /> Pro
            </Badge>
          </div>

          {evolution && evolution.length >= 2 ? (
            <>
              <div className="h-32">
                <PesoLineChartD data={evolution} left={-14} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Última bioimpedância: {evolution[evolution.length - 1]?.peso} kg · BF {evolution[evolution.length - 1]?.bf}%, acompanhamento do plano Pro.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-brand/20 bg-brand-soft/15 p-4 text-center">
              <p className="text-[13px] font-semibold text-foreground">Bioimpedância conectada</p>
              <p className="gf-card-text mt-1">
                No plano Pro, sincronize a balança/bioimpedância da academia e acompanhe peso, % de gordura e massa magra aqui.
              </p>
            </div>
          )}
        </div>

        {/* Programa de evolução de carga, opt-in, fora do topo */}
        <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "300ms" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="gf-section">Programa de evolução de carga</p>
              <p className="text-[13px] font-semibold text-foreground">
                {loadProgram ? "Ativo, registro rápido pré-preenchido" : "Acompanhe o aumento de carga nos exercícios"}
              </p>
              <p className="gf-card-text">
                Quando ativo, todo registro de série usa o valor anterior como base, só ajuste toque a toque, sem digitar do zero.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={loadProgram}
              aria-label="Ativar programa de evolução de carga"
              onClick={() => setLoadProgram((v) => !v)}
              className={cn(
                "gf-touch relative h-8 w-14 shrink-0 rounded-full border transition-colors",
                loadProgram ? "border-brand bg-brand" : "border-border bg-card"
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-all",
                  loadProgram ? "left-[calc(100%-1.75rem)]" : "left-1"
                )}
              />
            </button>
          </div>
          {loadProgram ? (
            <p className="mt-3 rounded-lg bg-brand-soft/40 px-3 py-2 text-[11px] font-medium text-brand">
              Registro ativado. Use o stepper +/− no registro de séries para subir a carga com segurança.
            </p>
          ) : null}
        </div>

        {/* Diário de treinos: sessões com feedback */}
        <SessionDiary sessions={data?.sessions ?? []} />

        {/* Relatório de evolução detalhado (pedido a cada 15 dias) */}
        <ReportRequestCard
          gymId={profile?.gym_id ?? ""}
          userId={user?.id ?? ""}
          lastReportAt={data?.lastReportAt ?? null}
          onRequested={refetch}
        />

        {/* Dicionário leigo, siglas e jargões explicados sem sair da tela */}
        <GlossaryCard
          className="gf-rise"
          items={[
            {
              term: "Volume",
              text: "Total de quilos que você moveu no dia (carga × repetições de cada série, somadas). Volume subindo com o tempo = força aumentando de verdade.",
            },
            {
              term: "Constância",
              text: "Quantos dias você treinou no mês. Ir com regularidade vale mais do que um treino perfeito isolado.",
            },
            {
              term: "Sequência (streak)",
              text: "Dias seguidos cumprindo seu plano. Não precisa ser todo dia, o que importa é não quebrar a corrente do seu ritmo.",
            },
            {
              term: "BF (% de gordura)",
              text: "Porcentagem de gordura corporal medida na bioimpedância. Acompanhe a tendência ao longo das semanas, não o número de um dia só.",
            },
            {
              term: "RPE",
              text: "Nota de 0 a 10 de como o treino pesou pra você. É o que ajuda o Assistente de Treino a calibrar a carga dos próximos dias.",
            },
          ]}
        />
      </div>
    </>
  );
}

/** Diário: histórico de sessões com sensação, nota e duração do aluno. */
function SessionDiary({ sessions }: { sessions: StudentSession[] }) {
  const withFeedback = sessions.filter((s) => s.meta?.feedback_at || s.meta?.feeling);
  if (withFeedback.length === 0) return null;
  return (
    <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "270ms" }}>
      <div className="mb-3 flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-brand" />
        <p className="gf-section">Diário de treinos</p>
      </div>
      <ul className="space-y-2">
        {withFeedback.slice(0, 6).map((s) => {
          const d = s.ended_at ? new Date(s.ended_at) : new Date(s.started_at);
          return (
            <li key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-foreground">
                  {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </p>
                {s.meta?.feeling ? (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                    {FEELING_LABEL[s.meta.feeling] ?? s.meta.feeling}
                  </span>
                ) : null}
                {typeof s.meta?.duration_min === "number" ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                    <Clock3 className="h-3 w-3" /> {s.meta.duration_min} min
                  </span>
                ) : null}
              </div>
              {s.meta?.note ? (
                <p className="mt-1 text-[11.5px] italic leading-snug text-muted-foreground">“{s.meta.note}”</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pedido de relatório de evolução detalhado (carência de 15 dias). */
function ReportRequestCard({
  gymId,
  userId,
  lastReportAt,
  onRequested,
}: {
  gymId: string;
  userId: string;
  lastReportAt: string | null;
  onRequested: () => void;
}) {
  const [sending, setSending] = useState(false);
  const left = reportCooldownLeft(lastReportAt);

  const send = async () => {
    if (!gymId || !userId || sending || left > 0) return;
    setSending(true);
    try {
      await requestEvolutionReport({ gymId, userId });
      toast.success("Pedido enviado!", { description: "Seu personal prepara o relatório detalhado." });
      onRequested();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu pra enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gf-rise gf-card gf-glass !py-4" style={{ animationDelay: "285ms" }}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10">
          <FileText className="h-4.5 w-4.5 text-brand" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="gf-section">Relatório de evolução</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {left > 0
              ? `Último pedido há pouco — novo relatório liberado em ${left} dia${left === 1 ? "" : "s"}.`
              : "Análise detalhada dos seus últimos 15 dias, preparada pelo seu personal."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={send}
        disabled={left > 0 || sending || !gymId || !userId}
        className="tactile mt-3 w-full rounded-2xl bg-brand py-3 text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40"
      >
        {sending ? "Enviando..." : left > 0 ? `Aguarde ${left} dia${left === 1 ? "" : "s"}` : "Pedir relatório detalhado"}
      </button>
    </div>
  );
}

function PassiveMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CalendarDays;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-3 py-2.5 text-center">
      <Icon className="mx-auto h-4 w-4 text-brand/70" />
      <p className="gf-hero-num mt-1 text-sm">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}