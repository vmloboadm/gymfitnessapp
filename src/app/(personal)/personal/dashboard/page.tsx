"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  MessageCircle,
  Flame,
  CircleAlert,
  ChevronRight,
  Bell,
  Activity,
  Users,
  ClipboardList,
  UserRoundX,
  Trophy,
  Newspaper,
  Dumbbell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/hooks/useAuth";
import { demoOnlineAgora } from "~/lib/demo-bridge";
import { LivePulse } from "~/components/dashboard/LivePulse";
import { CountUp } from "~/components/common/CountUp";
import { StudentSheet } from "~/components/personal/StudentSheet";
import {
  demoRadarAlerts,
  demoPersonalStudents,
  type RadarAlert,
  type PersonalStudent,
} from "~/lib/personal-data";
import { listAssignedWorkouts } from "~/lib/trainer-store";
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

/**
 * Cockpit de gestão do Personal: métricas com count-up, pulso da academia
 * e radar de retenção interativo (alerta abre o sheet do aluno).
 */
export default function PersonalDashboardPage() {
  const { profile } = useAuth();
  const alerts = useMemo(() => demoRadarAlerts(), []);
  const students = useMemo(() => demoPersonalStudents(), []);
  const online = useMemo(() => demoOnlineAgora(), []);
  const [sheetStudent, setSheetStudent] = useState<PersonalStudent | null>(null);

  // Métricas de gestão (demo: alunos + store local; produção: checkins/workout_programs)
  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const prescribedToday = listAssignedWorkouts().filter(
      (w) => new Date(w.created_at).toDateString() === todayKey
    ).length;
    return {
      activeStudents: students.filter((s) => s.lastTrainingDaysAgo <= 2).length,
      totalStudents: students.length,
      prescribedToday,
      missesWeek: students.filter((s) => s.lastTrainingDaysAgo >= 3).length,
    };
  }, [students, online]);

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

      {/* Radar de Retenção (interativo) */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="radar-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="radar-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Activity className="h-4 w-4 text-brand" />
            Radar de Retenção
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground">
            {counts.red} críticos · {counts.yellow} atenção · {counts.green} vitórias
          </p>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
          {alerts.map((a) => (
            <RadarCard key={a.id} alert={a} onOpenStudent={() => {
              const s = students.find((x) => x.id === a.studentId);
              if (s) setSheetStudent(s);
            }} />
          ))}
        </motion.div>
      </motion.section>

      {/* Ações rápidas: ranking com poderes, feed e biblioteca */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="quick-title">
        <h2 id="quick-title" className="mb-2 text-sm font-bold text-foreground">Ferramentas</h2>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/personal/ranking" className="gf-card gf-glass !rounded-2xl !p-3 text-center transition-transform active:scale-[0.96]">
            <Trophy className="mx-auto h-4.5 w-4.5 text-[#FFC24D]" />
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
    <motion.article
      variants={item}
      className={cn("gf-card gf-glass !p-4 transition-transform active:scale-[0.985]")}
    >
      {/* corpo do alerta: clicável, abre o sheet do aluno */}
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
