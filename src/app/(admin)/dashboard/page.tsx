"use client";

import Link from "next/link";
import { Users, Dumbbell, DollarSign, TrendingUp, AlarmClock, Wrench, ChevronRight, BarChart3 } from "lucide-react";
import { OcupacaoBarChart, ReceitaLineChart } from "~/components/charts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { StatCard } from "~/components/common/StatCard";
import { Badge } from "~/components/ui/badge";
import { SkeletonList, ErrorState } from "~/components/common/AsyncStates";
import { formatNumber } from "~/lib/utils/format";
import {
  isDemoMode,
  demoKpis,
  demoOcupacaoHorario,
  demoCheckinPorPlano,
  demoManutencaoRecorrente,
  demoTendenciaReceita,
} from "~/lib/demo-bridge";

type Kpis = {
  students: number;
  trainers: number;
  equipment: number;
  activeCheckins: number;
  revenue: number;
  revenueDeltaPct: number | null;
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error } = useAsyncQuery<Kpis>(
    async () => {
      if (demo) return { data: demoKpis(), error: null };
      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };
      const [sRes, tRes, eRes, cRes] = await Promise.all([
        supabase.from("profiles").select("id").eq("gym_id", profile.gym_id).eq("role", "student"),
        supabase.from("profiles").select("id").eq("gym_id", profile.gym_id).in("role", ["trainer", "manager"]),
        supabase.from("equipment").select("id").eq("gym_id", profile.gym_id),
        supabase.from("equipment_sessions").select("id").eq("gym_id", profile.gym_id).eq("status", "active"),
      ]);
      if (sRes.error || tRes.error || eRes.error || cRes.error) return { data: null, error: { message: "Erro" } };
      return {
        data: {
          students: sRes.data?.length ?? 0,
          trainers: tRes.data?.length ?? 0,
          equipment: eRes.data?.length ?? 0,
          activeCheckins: cRes.data?.length ?? 0,
          revenue: 0,
          revenueDeltaPct: null,
        },
        error: null,
      };
    },
    [profile?.id, demo]
  );

  const kpis = data;
  const ocupacao = demo ? demoOcupacaoHorario() : [];
  const planos = demo ? demoCheckinPorPlano() : [];
  const manut = demo ? demoManutencaoRecorrente() : [];
  const tendencia = demo ? demoTendenciaReceita() : [];

  const pico = ocupacao.reduce((a, b) => (b.alunos > a.alunos ? b : a), ocupacao[0] ?? { hora: "", alunos: 0 });
  const vazio = ocupacao.reduce((a, b) => (b.alunos < a.alunos ? b : a), ocupacao[0] ?? { hora: "", alunos: 0 });

  if (loading) {
    return (
      <div className="p-4">
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState message={error} onRetry={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Vista geral da academia</p>
        </div>
        <Link
          href="/matriculas"
          className="flex items-center gap-1 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs font-bold text-foreground hover:border-brand/40"
        >
          <Users className="h-3.5 w-3.5 text-brand" /> Matrículas
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Alunos" value={formatNumber(kpis?.students ?? 0)} delta={3.2} icon={Users} context="vs mês anterior" />
        <StatCard label="Personais" value={formatNumber(kpis?.trainers ?? 0)} icon={Dumbbell} context="equipe ativa" />
        <StatCard label="Aparelhos" value={`${formatNumber(kpis?.equipment ?? 0)}`} icon={BarChart3} context="cadastrados" />
        <StatCard label="Treinando agora" value={formatNumber(kpis?.activeCheckins ?? 0)} icon={TrendingUp} context="no momento" />
      </div>

      {/* Ocupação por horário */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <AlarmClock className="h-3.5 w-3.5 text-brand" /> Ocupação por horário
          </p>
          <Badge variant="outline" className="text-[10px]">pico {pico.hora} · vazio {vazio.hora}</Badge>
        </div>
        <div className="h-32">
          <OcupacaoBarChart data={ocupacao} />
        </div>
      </div>

      {/* Tendência de receita */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 text-brand" /> Tendência de receita
          </p>
          <Badge variant="success" className="text-[10px]">+12,4%</Badge>
        </div>
        <div className="h-28">
          <ReceitaLineChart data={tendencia} />
        </div>
      </div>

      {/* Check-in por tipo de matrícula — destaque Gympass/TotalPass */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-brand" /> Check-in por tipo de matrícula
        </p>
        <div className="space-y-3">
          {planos.map((p) => {
            const isPlataforma = p.plano === "Gympass" || p.plano === "TotalPass";
            return (
              <div key={p.plano} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    {p.plano}
                    {isPlataforma && <Badge variant="outline" className="text-[9px]">plataforma</Badge>}
                  </span>
                  <span className="text-muted-foreground">{p.checkins} check-ins</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-card/60">
                  <div
                    className={`h-full rounded-full ${isPlataforma ? "bg-warning" : "bg-brand"}`}
                    style={{ width: `${p.taxa}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  taxa de presença {p.taxa}% · {p.alunos} alunos
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-[11px] text-warning">
          Aluno de plataforma tem o menor vínculo com a unidade — use streaks e comunidade para fidelizar.
        </p>
      </div>

      {/* Manutenção recorrente */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Wrench className="h-3.5 w-3.5 text-brand" /> Manutenção recorrente
          </p>
          <Link href="/equipamentos" className="flex items-center gap-0.5 text-[11px] font-semibold text-brand">
            Ver todos <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-1.5">
          {manut.map((m) => (
            <Link
              key={m.id}
              href="/equipamentos"
              className="tactile flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning text-lg">🛠️</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">{m.abertos} abertos · {m.resolvidos} resolvidos · {m.ultimo}</p>
              </div>
              <Badge variant="warning" className="text-[10px]">reincidente</Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: "/matriculas", label: "Nova matrícula", emoji: "📋" },
          { href: "/personais", label: "Adicionar personal", emoji: "🧑‍🏫" },
          { href: "/equipamentos", label: "Marcar manutenção", emoji: "🛠️" },
          { href: "/relatorios", label: "Relatórios", emoji: "📊" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="tactile flex items-center gap-2 rounded-xl border border-border bg-card/40 p-3.5"
          >
            <span className="text-lg">{a.emoji}</span>
            <span className="text-xs font-semibold text-foreground">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}