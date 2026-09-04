"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users, Dumbbell, DollarSign, TrendingUp, AlarmClock, BarChart3 } from "lucide-react";
import { OcupacaoBarChart, ReceitaLineChart } from "~/components/charts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { StatCard } from "~/components/common/StatCard";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { SkeletonList, ErrorState } from "~/components/common/AsyncStates";
import { formatNumber } from "~/lib/utils/format";
import {
  isDemoMode,
  demoKpis,
  demoOpenSessions,
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

  // Ocupação REAL: checkins de entrada de hoje agrupados por hora (6h–22h)
  const { data: todayCheckins } = useAsyncQuery<string[]>(
    async () => {
      if (demo || !profile?.gym_id) return { data: [], error: null };
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabaseBrowser()
        .from("checkins")
        .select("checked_at")
        .eq("gym_id", profile.gym_id)
        .eq("type", "entrada")
        .gte("checked_at", start.toISOString());
      if (error) return { data: [], error: null };
      return { data: (data as { checked_at: string }[]).map((r) => r.checked_at), error: null };
    },
    [profile?.gym_id, demo]
  );

  const ocupacao = useMemo(() => {
    if (demo) return demoOcupacaoHorario();
    const counts = new Array(17).fill(0) as number[]; // 6h..22h
    for (const iso of todayCheckins ?? []) {
      const h = new Date(iso).getHours();
      if (h >= 6 && h <= 22) counts[h - 6]++;
    }
    return counts.map((n, i) => ({ hora: `${i + 6}h`, alunos: n }));
  }, [demo, todayCheckins]);

  const planos = demo ? demoCheckinPorPlano() : [];
  const _manut = demo ? demoManutencaoRecorrente() : [];
  const tendencia = demo ? demoTendenciaReceita() : [];

  const pico = ocupacao.reduce((a, b) => (b.alunos > a.alunos ? b : a), ocupacao[0] ?? { hora: "", alunos: 0 });
  const vazio = ocupacao.reduce((a, b) => (b.alunos < a.alunos ? b : a), ocupacao[0] ?? { hora: "", alunos: 0 });
  const primeiroNome = (profile?.name ?? "Gestor").split(" ")[0];

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
      {/* Header com avatar + saudação */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0 border border-brand/40">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.name ?? "Gestor"} />
            ) : null}
            <AvatarFallback className="bg-brand/15 text-sm font-black text-brand">
              {primeiroNome.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight text-foreground">{primeiroNome}</h1>
            <p className="text-xs text-muted-foreground">Vista geral da academia</p>
          </div>
        </div>
        <Link
          href="/matriculas"
          className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs font-bold text-foreground hover:border-brand/40"
        >
          <Users className="h-3.5 w-3.5 text-brand" /> Matrículas
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Alunos" value={formatNumber(kpis?.students ?? 0)} delta={3.2} icon={Users} context="vs mês anterior" />
        <StatCard label="Personais" value={formatNumber(kpis?.trainers ?? 0)} icon={Dumbbell} context="equipe ativa" />
        <StatCard label="Aparelhos" value={`${formatNumber(kpis?.equipment ?? 0)}`} icon={BarChart3} context="cadastrados" />
        <StatCard label="Treinando agora" value={formatNumber(kpis?.activeCheckins ?? 0)} icon={TrendingUp} context="no momento" />
      </div>

      {/* ALERTA DE SEGURANÇA — sessões abertas há mais de 2h */}
      {(() => {
        const open = isDemoMode() ? (demoOpenSessions() as any[]).filter((s: any) => Date.now() - new Date(s.started_at).getTime() >= 2 * 3600000) : [];
        if (open.length === 0) return null;
        return (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-destructive">
              ⚠ Sessões abertas há mais de 2h — verificar ocorrência
            </p>
            <div className="mt-2 space-y-1.5">
              {open.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2">
                  <span className="text-sm font-bold text-foreground">{s.student_name}</span>
                  <span className="text-xs text-muted-foreground">{s.equipment_name} · desde {new Date(s.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Ocupação por horário (REAL via checkins; demo usa mock) */}
      {ocupacao.some((o) => o.alunos > 0) || demo ? (
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
      ) : null}

      {/* Tendência de receita — só quando há dados (demo/pagamentos) */}
      {tendencia.length > 0 ? (
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
      ) : null}

      {/* Check-in por tipo de matrícula — só quando há dados (demo/pagamentos) */}
      {planos.length > 0 ? (
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
          Aluno de plataforma tem o menor vínculo com a unidade, use streaks e comunidade para fidelizar.
        </p>
        </div>
      ) : null}

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { href: "/matriculas", label: "Nova matrícula", emoji: "📋" },
          { href: "/personais", label: "Adicionar personal", emoji: "🧑‍🏫" },
          { href: "/biblioteca", label: "Biblioteca de exercícios", emoji: "📚" },
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