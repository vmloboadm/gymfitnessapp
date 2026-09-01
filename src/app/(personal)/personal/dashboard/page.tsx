"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  MessageCircle,
  Flame,
  Trophy,
  CircleAlert,
  ChevronRight,
  Bell,
  Activity,
  Users,
  ClipboardList,
  UserRoundX,
  Trophy as TrophyIcon,
  Newspaper,
  Dumbbell,
  CalendarCheck,
  Sparkles,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/hooks/useAuth";
import { demoOnlineAgora } from "~/lib/demo-bridge";
import { LivePulse } from "~/components/dashboard/LivePulse";
import { CountUp } from "~/components/common/CountUp";
import { StudentSheet } from "~/components/personal/StudentSheet";
import {
  computeRadar,
  demoPersonalStudents,
  type RadarAlert,
  type PersonalStudent,
} from "~/lib/personal-data";
import { briefingOffline } from "~/lib/ai/local-gen";
import {
  listAssignedWorkouts,
  pendingApprovalCount,
  TRAINER_WORKOUTS_EVENT,
  TRAINER_APPROVALS_EVENT,
  TRAINER_POINTS_EVENT,
} from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

const SEVERITY = {
  red: {
    ring: "border-[#F87171]/25 bg-[#F87171]/[0.07]",
    icon: "border-[#F87171]/25 bg-[#F87171]/10 text-[#F87171]",
    Icon: CircleAlert,
  },
  yellow: {
    ring: "border-[#FFC24D]/25 bg-[#FFC24D]/[0.07]",
    icon: "border-[#FFC24D]/25 bg-[#FFC24D]/10 text-[#FFC24D]",
    Icon: Flame,
  },
  green: {
    ring: "border-[#4ADE80]/25 bg-[#4ADE80]/[0.07]",
    icon: "border-[#4ADE80]/25 bg-[#4ADE80]/10 text-[#4ADE80]",
    Icon: Trophy,
  },
} as const;

function waHref(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [1, 3, 5], // segunda
  2: [2, 4, 6],
  3: [1, 3, 5],
  4: [2, 4, 6],
  5: [1, 3, 5],
  6: [2, 4, 6],
  0: [0],
};

/**
 * Cockpit de gestão do Personal: briefing IA do dia, métricas com count-up,
 * pulso da academia, agenda de hoje e radar de retenção que reage às ações.
 */
export default function PersonalDashboardPage() {
  const { profile } = useAuth();
  const students = useMemo(() => demoPersonalStudents(), []);
  const online = useMemo(() => demoOnlineAgora(), []);
  const [sheetStudent, setSheetStudent] = useState<PersonalStudent | null>(null);
  const [tick, setTick] = useState(0);

  // reage a TODAS as ações do personal (atribuir treino, aprovar, penalizar)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(TRAINER_WORKOUTS_EVENT, bump);
    window.addEventListener(TRAINER_APPROVALS_EVENT, bump);
    window.addEventListener(TRAINER_POINTS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(TRAINER_WORKOUTS_EVENT, bump);
      window.removeEventListener(TRAINER_APPROVALS_EVENT, bump);
      window.removeEventListener(TRAINER_POINTS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const assigned = useMemo(() => listAssignedWorkouts(), [tick]);
  const pendingApprovals = useMemo(() => pendingApprovalCount(), [tick]);

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const prescribedToday = assigned.filter(
      (w) => new Date(w.created_at).toDateString() === todayKey
    ).length;
    return {
      activeStudents: students.filter((s) => s.lastTrainingDaysAgo <= 2).length,
      totalStudents: students.length,
      prescribedToday,
      missesWeek: students.filter((s) => s.lastTrainingDaysAgo >= 3).length,
    };
  }, [students, assigned, tick]);

  // Radar dinâmico: deriva do estado real
  const alerts = useMemo(
    () =>
      computeRadar(
        students,
        assigned.map((w) => ({ studentId: w.studentId, createdAtIso: w.created_at }))
      ),
    [students, assigned, tick]
  );

  // Briefing IA do dia (LLM quando configurado; motor local de bolso sempre)
  const briefing = useMemo(
    () =>
      briefingOffline({
        activeToday: stats.activeStudents,
        totalStudents: stats.totalStudents,
        missesWeek: stats.missesWeek,
        prescribedToday: stats.prescribedToday,
        pendingApprovals,
        worstStudent:
          students.filter((s) => s.lastTrainingDaysAgo >= 3).sort((a, b) => b.lastTrainingDaysAgo - a.lastTrainingDaysAgo)[0]?.name ?? null,
        worstDays: Math.max(0, ...students.map((s) => s.lastTrainingDaysAgo)),
        topStudent: students.find((s) => s.lastTrainingDaysAgo === 0)?.name ?? null,
      }),
    [stats, pendingApprovals, students, tick]
  );

  // Agenda de hoje: quem tem treino pautado no dia da semana
  const agenda = useMemo(() => {
    const dow = new Date().getDay();
    return students.filter((s) => {
      if (s.freq >= 5) return dow >= 1 && dow <= 5;
      return (WEEKDAY_PATTERN[dow] ?? []).includes((s.id.charCodeAt(3) + dow) % 6 || 1);
    }).slice(0, 4);
  }, [students, tick]);

  const counts = {
    red: alerts.filter((a) => a.severity === "red").length,
    yellow: alerts.filter((a) => a.severity === "yellow").length,
    green: alerts.filter((a) => a.severity === "green").length,
  };

  return (
    <div className="space-y-5">
      {/* Header: identidade do personal */}
      <motion.header variants={item} initial="hidden" animate="show" className="flex items-center gap-3">
        <span className="relative shrink-0 rounded-full bg-brand p-[2px] shadow-[0_0_18px_rgba(244,113,30,0.35)]">
          <Avatar className="h-12 w-12 border-2 border-background">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? "Personal"} />
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
              {(profile?.name?.[0] ?? "P").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-foreground">
            {profile?.name ?? "Personal"}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">
            Personal Trainer
          </p>
        </div>
        <button
          aria-label="Notificações"
          className="tactile flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>
      </motion.header>

      {/* Briefing IA do dia */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="briefing-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="briefing-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-brand" />
            Briefing do dia
          </h2>
          <button
            onClick={() => setTick((t) => t + 1)}
            aria-label="Atualizar briefing"
            className="tactile flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-brand"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        <div className="gf-card gf-glass !p-4">
          <p className="text-[12.5px] leading-relaxed text-foreground/90">{briefing}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {pendingApprovals > 0 ? (
              <Link
                href="/personal/aprovacoes"
                className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-bold text-brand ring-1 ring-brand/30"
              >
                <Inbox className="h-3 w-3" />
                {pendingApprovals} aprovaç{pendingApprovals === 1 ? "ão" : "ões"} pendente{pendingApprovals === 1 ? "" : "s"}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[9.5px] font-semibold text-muted-foreground">
              {stats.missesWeek} falta{stats.missesWeek === 1 ? "" : "s"} na semana
            </span>
          </div>
        </div>
      </motion.section>

      {/* Métricas de gestão (count-up) */}
      <motion.div variants={item} initial="hidden" animate="show" className="grid grid-cols-3 gap-2">
        <Link href="/personal/alunos" className="gf-card gf-glass !rounded-2xl !p-3 transition-transform active:scale-[0.97]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
            <Users className="h-3.5 w-3.5 text-brand" />
          </span>
          <p className="mt-2 font-display text-xl font-black leading-none text-foreground">
            <CountUp value={stats.activeStudents} />
            <span className="text-[11px] font-bold text-muted-foreground">/{stats.totalStudents}</span>
          </p>
          <p className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground">
            Ativos hoje
          </p>
        </Link>
        <div className="gf-card gf-glass !rounded-2xl !p-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#4ADE80]/25 bg-[#4ADE80]/10">
            <ClipboardList className="h-3.5 w-3.5 text-[#4ADE80]" />
          </span>
          <p className="mt-2 font-display text-xl font-black leading-none text-foreground">
            <CountUp value={stats.prescribedToday} />
          </p>
          <p className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground">
            Treinos prescritos hoje
          </p>
        </div>
        <div className="gf-card gf-glass !rounded-2xl !p-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#F87171]/25 bg-[#F87171]/10">
            <UserRoundX className="h-3.5 w-3.5 text-[#F87171]" />
          </span>
          <p className="mt-2 font-display text-xl font-black leading-none text-foreground">
            <CountUp value={stats.missesWeek} />
          </p>
          <p className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground">
            Faltas da semana
          </p>
        </div>
      </motion.div>

      {/* Pulso da academia (mesmo componente do aluno) */}
      <motion.div variants={item} initial="hidden" animate="show">
        <LivePulse online={online} />
      </motion.div>

      {/* Agenda de hoje */}
      {agenda.length > 0 ? (
        <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="agenda-title">
          <h2 id="agenda-title" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <CalendarCheck className="h-4 w-4 text-brand" />
            Agenda de hoje
          </h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {agenda.map((s) => (
              <button
                key={s.id}
                onClick={() => setSheetStudent(s)}
                className="gf-card gf-glass w-[128px] shrink-0 !rounded-2xl !p-3 text-center transition-transform active:scale-[0.96]"
              >
                <div className="relative mx-auto w-fit">
                  <Avatar className="h-12 w-12 border-2 border-white/[0.08]">
                    <AvatarImage src={s.avatar} alt={s.name} />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                      {s.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0B1220]",
                      s.lastTrainingDaysAgo === 0 ? "bg-[#4ADE80]" : s.lastTrainingDaysAgo <= 2 ? "bg-[#FFC24D]" : "bg-[#F87171]"
                    )}
                    aria-hidden
                  />
                </div>
                <p className="mt-1.5 truncate text-[11px] font-bold text-foreground">
                  {s.name.split(" ")[0]}
                </p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {s.lastTrainingDaysAgo === 0 ? "check-in feito" : `${s.freq}x semana`}
                </p>
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      {/* Radar de Retenção (dinâmico) */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="radar-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="radar-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Activity className="h-4 w-4 text-brand" />
            Radar de Retenção
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground">
            {counts.red} críticos · {counts.yellow} atenção · {counts.green} positivos
          </p>
        </div>

        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-[#4ADE80]/25 bg-[#4ADE80]/[0.06] p-5 text-center">
            <TrophyIcon className="mx-auto mb-1.5 h-5 w-5 text-[#4ADE80]" />
            <p className="text-[12px] font-bold text-foreground">Nenhum alerta, turma em dia</p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              O radar atualiza sozinho quando alguém some, registra RPE alto ou recebe plano novo.
            </p>
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
            {alerts.map((a) => (
              <RadarCard key={a.id} alert={a} onOpenStudent={() => {
                const s = students.find((x) => x.id === a.studentId);
                if (s) setSheetStudent(s);
              }} />
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* Ações rápidas */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="quick-title">
        <h2 id="quick-title" className="mb-2 text-sm font-bold text-foreground">Ferramentas</h2>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/personal/ranking" className="gf-card gf-glass !rounded-2xl !p-3 text-center transition-transform active:scale-[0.96]">
            <TrophyIcon className="mx-auto h-4.5 w-4.5 text-[#FFC24D]" />
            <p className="mt-1.5 text-[10px] font-bold text-foreground">Ranking</p>
            <p className="text-[8.5px] text-muted-foreground">validar pontos</p>
          </Link>
          <Link href="/feed" className="gf-card gf-glass !rounded-2xl !p-3 text-center transition-transform active:scale-[0.96]">
            <Newspaper className="mx-auto h-4.5 w-4.5 text-brand" />
            <p className="mt-1.5 text-[10px] font-bold text-foreground">Feed</p>
            <p className="text-[8.5px] text-muted-foreground">comunidade</p>
          </Link>
          <Link href="/personal/exercicios" className="gf-card gf-glass !rounded-2xl !p-3 text-center transition-transform active:scale-[0.96]">
            <Dumbbell className="mx-auto h-4.5 w-4.5 text-[#4ADE80]" />
            <p className="mt-1.5 text-[10px] font-bold text-foreground">Exercícios</p>
            <p className="text-[8.5px] text-muted-foreground">289 na base</p>
          </Link>
        </div>
      </motion.section>

      <StudentSheet student={sheetStudent} onClose={() => setSheetStudent(null)} />
    </div>
  );
}

function RadarCard({ alert, onOpenStudent }: { alert: RadarAlert; onOpenStudent: () => void }) {
  const sev = SEVERITY[alert.severity];
  const { Icon } = sev;
  const wa = alert.whatsapp;

  return (
    <motion.article variants={item} className={cn("gf-card gf-glass !p-4 transition-transform active:scale-[0.985]")}>
      <button onClick={onOpenStudent} className="flex w-full items-start gap-3 text-left">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", sev.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug text-foreground">{alert.message}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{alert.detail}</p>
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-brand/80">
            Ver ficha do aluno <ChevronRight className="h-3 w-3" />
          </p>
        </div>
      </button>

      <div className="mt-3 flex items-center gap-2">
        {wa && wa.consent ? (
          <a
            href={waHref(wa.phone, wa.text)}
            target="_blank"
            rel="noreferrer"
            className="tactile inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 text-[11px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.96]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {wa.label ?? "WhatsApp"}
          </a>
        ) : wa && !wa.consent ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 text-[11px] font-medium text-muted-foreground ring-1 ring-white/[0.06]">
            <MessageCircle className="h-3.5 w-3.5" />
            Sem consentimento
          </span>
        ) : null}

        {alert.action ? (
          <Link
            href={alert.action.href}
            className="tactile inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand/15 px-3 text-[11px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.96]"
          >
            {alert.action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </motion.article>
  );
}
