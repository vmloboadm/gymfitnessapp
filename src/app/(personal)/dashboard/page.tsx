"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Dumbbell,
  AlarmClock,
  ClipboardCheck,
  Activity,
  ChevronRight,
  ClipboardList,
  UserRound,
  BarChart3,
} from "lucide-react";
import { OcupacaoBarChart } from "~/components/charts";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import {
  useCheckinsRealtime,
  useEquipmentSessionsRealtime,
  usePremiumRequestsRealtime,
} from "~/hooks/useRealtimeSubscriptions";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { SkeletonList, ErrorState } from "~/components/common/AsyncStates";
import { formatNumber } from "~/lib/utils/format";
import { isDemoMode, demoKpis, demoOcupacaoHorario } from "~/lib/demo-bridge";

type ActiveSession = {
  id: string;
  started_at: string;
  equipment: { name: string } | null;
  student: { name: string } | null;
};

type PendingRequest = {
  id: string;
  details: string | null;
  created_at: string;
  student: { name: string } | null;
};

type DashboardData = {
  students: number;
  equipment: number;
  presentes: number;
  checkinsHoje: number;
  workoutsHoje: number;
  sessions: ActiveSession[];
  fluxoSemana: { label: string; n: number }[];
  ocupacao: { hora: string; alunos: number }[];
  pendentes: PendingRequest[];
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const demo = isDemoMode();
  const [, setTick] = useState(0);

  // tick por minuto p/ tempo decorrido das sessões
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const query = async (): Promise<{ data: DashboardData | null; error: { message: string } | null }> => {
    if (demo) {
      const k = demoKpis();
      return {
        data: {
          students: k.students,
          equipment: k.equipment,
          presentes: k.activeCheckins,
          checkinsHoje: k.activeCheckins,
          workoutsHoje: 0,
          sessions: [],
          fluxoSemana: [],
          ocupacao: demoOcupacaoHorario(),
          pendentes: [],
        },
        error: null,
      };
    }
    if (!profile) return { data: null, error: { message: "Perfil indisponível" } };
    const gym = profile.gym_id;
    const sb = supabaseBrowser();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const start7 = new Date();
    start7.setDate(start7.getDate() - 6);
    start7.setHours(0, 0, 0, 0);

    const [sRes, eRes, sessRes, entRes, saiRes, logsRes, pendRes] = await Promise.all([
      sb.from("profiles").select("id").eq("gym_id", gym).eq("role", "student"),
      sb.from("equipment").select("id").eq("gym_id", gym),
      sb
        .from("equipment_sessions")
        .select("id, started_at, equipment:equipment_id ( name ), student:student_id ( name )")
        .eq("gym_id", gym)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(12),
      sb.from("checkins").select("checked_at").eq("gym_id", gym).eq("type", "entrada").gte("checked_at", start7.toISOString()),
      sb.from("checkins").select("checked_at").eq("gym_id", gym).eq("type", "saida").gte("checked_at", startToday.toISOString()),
      sb.from("workout_logs").select("id").eq("gym_id", gym).gte("logged_at", startToday.toISOString()),
      sb
        .from("premium_requests")
        .select("id, details, created_at, student:student_id ( name )")
        .eq("gym_id", gym)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3) as unknown as Promise<{ data: PendingRequest[] | null; error: { message: string } | null }>,
    ]);
    if (sRes.error || eRes.error || sessRes.error || entRes.error || saiRes.error || logsRes.error || pendRes.error) {
      return { data: null, error: { message: "Erro ao carregar dados do dashboard" } };
    }

    const entradas = (entRes.data ?? []) as { checked_at: string }[];
    const saidasHoje = (saiRes.data ?? []) as { checked_at: string }[];

    // ocupação por hora (hoje, 6h–22h)
    const counts = new Array(17).fill(0) as number[];
    for (const r of entradas) {
      const d = new Date(r.checked_at);
      if (d >= startToday && d.getHours() >= 6 && d.getHours() <= 22) counts[d.getHours() - 6]++;
    }

    // fluxo últimos 7 dias
    const fluxo = new Array(7).fill(0) as number[];
    for (const r of entradas) {
      const d = new Date(r.checked_at);
      const idx = Math.floor((new Date(d).setHours(0, 0, 0, 0) - start7.setHours(0, 0, 0, 0)) / 86400000);
      if (idx >= 0 && idx < 7) fluxo[idx]++;
    }
    const fluxoSemana = fluxo.map((n, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: DIAS[d.getDay()], n };
    });

    const presentes = Math.max(0, entradas.filter((r) => new Date(r.checked_at) >= startToday).length - saidasHoje.length);

    return {
      data: {
        students: sRes.data?.length ?? 0,
        equipment: eRes.data?.length ?? 0,
        presentes,
        checkinsHoje: entradas.filter((r) => new Date(r.checked_at) >= startToday).length,
        workoutsHoje: logsRes.data?.length ?? 0,
        sessions: (sessRes.data ?? []) as unknown as ActiveSession[],
        fluxoSemana,
        ocupacao: counts.map((n, i) => ({ hora: `${i + 6}h`, alunos: n })),
        pendentes: (pendRes.data ?? []) as unknown as PendingRequest[],
      },
      error: null,
    };
  };

  const { data, loading, error, refetch } = useAsyncQuery<DashboardData>(query, [profile?.id, demo]);

  // live: checkins, aparelhos e aprovações atualizam o dashboard sem refresh
  useCheckinsRealtime(profile?.gym_id, refetch);
  useEquipmentSessionsRealtime(profile?.gym_id, refetch);
  usePremiumRequestsRealtime(profile?.gym_id, refetch);

  const primeiroNome = (profile?.name ?? "Gestor").split(" ")[0];
  const pico = data?.ocupacao.reduce((a, b) => (b.alunos > a.alunos ? b : a), data?.ocupacao[0] ?? { hora: "", alunos: 0 });
  const fluxoMax = Math.max(1, ...(data?.fluxoSemana.map((f) => f.n) ?? [1]));
  const hojeLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const elapsed = (iso: string) => {
    const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="p-4">
        <SkeletonList rows={5} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-4">
        <ErrorState message={error ?? "Erro"} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0 border border-brand/40">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.name ?? "Gestor"} /> : null}
            <AvatarFallback className="bg-brand/15 text-sm font-black text-brand">
              {primeiroNome.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight text-foreground">
              {greeting()}, {primeiroNome}
            </h1>
            <p className="text-xs capitalize text-muted-foreground">{hojeLabel}</p>
          </div>
        </div>
        <Link
          href="/matriculas"
          className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs font-bold text-foreground hover:border-brand/40"
        >
          <Users className="h-3.5 w-3.5 text-brand" /> Matrículas
        </Link>
      </div>

      {/* HERO — AGORA (live) */}
      <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/15 via-card/60 to-card/40 p-4">
        <div className="flex items-start justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-brand" /> Agora na academia
          </p>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            live
          </span>
        </div>
        <p className="mt-1 text-5xl font-black leading-none tracking-tight text-foreground">{formatNumber(data.presentes)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.presentes === 1 ? "aluno na academia agora" : "alunos na academia agora"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card/70 px-2.5 py-2">
            <p className="text-sm font-black text-foreground">
              {data.sessions.length}/{data.equipment}
            </p>
            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">aparelhos em uso</p>
          </div>
          <div className="rounded-xl bg-card/70 px-2.5 py-2">
            <p className="text-sm font-black text-foreground">{formatNumber(data.checkinsHoje)}</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">check-ins hoje</p>
          </div>
          <div className="rounded-xl bg-card/70 px-2.5 py-2">
            <p className="text-sm font-black text-foreground">{formatNumber(data.workoutsHoje)}</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">treinos hoje</p>
          </div>
        </div>
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/personal/alunos" className="tactile rounded-2xl border border-border bg-card/50 p-3.5 transition-colors hover:border-brand/40">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alunos</p>
            <UserRound className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-foreground">{formatNumber(data.students)}</p>
          <p className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
            ver lista <ChevronRight className="h-3 w-3" />
          </p>
        </Link>
        <Link href="/personal/aprovacoes" className="tactile rounded-2xl border border-border bg-card/50 p-3.5 transition-colors hover:border-brand/40">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pendências</p>
            <ClipboardCheck className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-1.5 text-2xl font-black text-foreground">{formatNumber(data.pendentes.length)}</p>
          <p className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
            {data.pendentes.length > 0 ? "revisar agora" : "tudo em dia"} <ChevronRight className="h-3 w-3" />
          </p>
        </Link>
      </div>

      {/* Aparelhos em uso (REAL + live) */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Dumbbell className="h-3.5 w-3.5 text-brand" /> Aparelhos em uso
          </p>
          <Badge variant="outline" className="text-[10px]">
            {data.sessions.length} de {data.equipment}
          </Badge>
        </div>
        {data.sessions.length === 0 ? (
          <p className="mt-3 rounded-xl bg-card/60 px-3 py-3 text-[11.5px] text-muted-foreground">
            Nenhum aparelho em uso neste momento.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {data.sessions.map((s) => {
              const mins = (Date.now() - new Date(s.started_at).getTime()) / 60000;
              const over2h = mins >= 120;
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${over2h ? "bg-destructive/10 ring-1 ring-destructive/30" : "bg-card/70"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-foreground">{s.student?.name ?? "Aluno"}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground">{s.equipment?.name ?? "Aparelho"}</p>
                  </div>
                  <p className={`shrink-0 text-[10.5px] font-bold ${over2h ? "text-destructive" : "text-brand"}`}>
                    {over2h ? "⚠ " : ""}{elapsed(s.started_at)}
                  </p>
                </div>
              );
            })}
            {data.sessions.some((s) => (Date.now() - new Date(s.started_at).getTime()) / 60000 >= 120) ? (
              <p className="px-1 text-[10px] font-semibold text-destructive">
                ⚠ Sessão aberta há mais de 2h — verificar ocorrência
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Ocupação por horário (real) */}
      <div className="rounded-2xl border border-border bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <AlarmClock className="h-3.5 w-3.5 text-brand" /> Ocupação por horário
          </p>
          <Badge variant="outline" className="text-[10px]">pico {pico?.hora ?? "—"}</Badge>
        </div>
        <div className="h-32">
          <OcupacaoBarChart data={data.ocupacao} />
        </div>
      </div>

      {/* Fluxo dos últimos 7 dias (real) */}
      {!demo ? (
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-brand" /> Fluxo · últimos 7 dias
            </p>
            <Badge variant="outline" className="text-[10px]">
              {data.fluxoSemana.reduce((a, b) => a + b.n, 0)} check-ins
            </Badge>
          </div>
          <div className="flex h-28 items-end justify-between gap-1.5">
            {data.fluxoSemana.map((f, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <p className="text-[10px] font-bold text-foreground">{f.n > 0 ? f.n : ""}</p>
                <div
                  className={`w-full rounded-t-md ${f.n > 0 ? (i === 6 ? "bg-brand" : "bg-brand/40") : "bg-card/60"}`}
                  style={{ height: `${Math.max(4, (f.n / fluxoMax) * 72)}px` }}
                />
                <p className={`text-[9px] font-semibold ${i === 6 ? "text-brand" : "text-muted-foreground"}`}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Fila de aprovações (real + live) */}
      {!demo && data.pendentes.length > 0 ? (
        <Link href="/personal/aprovacoes" className="block rounded-2xl border border-warning/30 bg-warning/[0.06] p-4 transition-colors hover:border-warning/60">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-warning">
              <ClipboardList className="h-3.5 w-3.5" /> Fila de aprovações
            </p>
            <Badge variant="outline" className="border-warning/40 text-[10px] text-warning">{data.pendentes.length} aguardando</Badge>
          </div>
          <div className="mt-2 space-y-1.5">
            {data.pendentes.map((p) => (
              <div key={p.id} className="rounded-xl bg-card/70 px-3 py-2">
                <p className="text-[11.5px] font-bold text-foreground">{p.student?.name ?? "Aluno"}</p>
                <p className="truncate text-[10.5px] text-muted-foreground">{p.details ?? "Pedido"}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-warning">
            Abrir aprovações <ChevronRight className="h-3 w-3" />
          </p>
        </Link>
      ) : null}

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { href: "/matriculas", label: "Nova matrícula", emoji: "📋" },
          { href: "/personal/treinos", label: "Criar treino", emoji: "🧩" },
          { href: "/biblioteca", label: "Biblioteca de exercícios", emoji: "📚" },
          { href: "/personal/perfil", label: "Frase motivacional", emoji: "💬" },
          { href: "/relatorios", label: "Relatórios", emoji: "📊" },
          { href: "/feed-moderacao", label: "Moderar feed", emoji: "🛡️" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="tactile flex items-center gap-2 rounded-xl border border-border bg-card/40 p-3.5"
          >
            <span className="text-lg">{a.emoji}</span>
            <span className="text-xs font-semibold text-foreground">{a.label}</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
