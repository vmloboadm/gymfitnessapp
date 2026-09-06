"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, type Variants } from "framer-motion";
import {
  MessageCircle,
  Flame,
  Trophy,
  CircleAlert,
  ChevronRight,
  Bell,
  Users,
  ClipboardList,
  UserRoundX,
  Trophy as TrophyIcon,
  Newspaper,
  Dumbbell,
  CalendarCheck,
  ListChecks,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { useAuth } from "~/hooks/useAuth";
import { demoOnlineAgora } from "~/lib/demo-bridge";
import { LivePulse } from "~/components/dashboard/LivePulse";
import { CountUp } from "~/components/common/CountUp";
import { StudentSheet } from "~/components/personal/StudentSheet";
import type { PersonalStudent } from "~/lib/personal-data";
import { getGymStudents } from "~/lib/gym-api";
import { briefingOffline } from "~/lib/ai/local-gen";
import { computeQueue, type QueueItem } from "~/lib/personal-queue";
import {
  listAssignedWorkouts,
  pendingApprovalCount,
  TRAINER_WORKOUTS_EVENT,
  TRAINER_APPROVALS_EVENT,
  TRAINER_POINTS_EVENT,
} from "~/lib/trainer-store";
import { cn } from "~/lib/utils";

const _container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

const TONE = {
  red: {
    ring: "border-[#F87171]/25 bg-[#F87171]/[0.07]",
    icon: "border-[#F87171]/25 bg-[#F87171]/10 text-[#F87171]",
  },
  amber: {
    ring: "border-[#FFC24D]/25 bg-[#FFC24D]/[0.07]",
    icon: "border-[#FFC24D]/25 bg-[#FFC24D]/10 text-[#FFC24D]",
  },
  green: {
    ring: "border-[#4ADE80]/25 bg-[#4ADE80]/[0.07]",
    icon: "border-[#4ADE80]/25 bg-[#4ADE80]/10 text-[#4ADE80]",
  },
} as const;

const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [1, 3, 5],
  2: [2, 4, 6],
  3: [1, 3, 5],
  4: [2, 4, 6],
  5: [1, 3, 5],
  6: [2, 4, 6],
  0: [0],
};

function waHref(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Cockpit de gestão do Personal: Fila de Hoje (ações acionáveis derivadas
 * do estado real, espelhadas no sino), métricas com count-up, pulso da
 * academia e agenda do dia.
 */
export default function PersonalDashboardPage() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? "";
  const [students, setStudents] = useState<PersonalStudent[]>([]);
  const online = useMemo(() => demoOnlineAgora(), []);
  const [sheetStudent, setSheetStudent] = useState<PersonalStudent | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
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

  useEffect(() => {
    if (!gymId) return;
    getGymStudents(gymId).then(setStudents).catch(() => setStudents([]));
  }, [gymId, tick]);

  const assigned = useMemo(() => listAssignedWorkouts(), [tick]);
  const pendingApprovals = useMemo(() => pendingApprovalCount(), [tick]);

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const yesterdayKey = new Date(Date.now() - 864e5).toDateString();
    const prescribedToday = assigned.filter(
      (w) => new Date(w.created_at).toDateString() === todayKey
    ).length;
    const prescribedYesterday = assigned.filter(
      (w) => new Date(w.created_at).toDateString() === yesterdayKey
    ).length;
    return {
      activeStudents: students.filter((s) => s.lastTrainingDaysAgo <= 2).length,
      totalStudents: students.length,
      prescribedToday,
      prescribedYesterday,
      missesWeek: students.filter((s) => s.lastTrainingDaysAgo >= 3).length,
    };
  }, [students, assigned, tick]);

  // Fila de Hoje: ações acionáveis derivadas do estado real
  const queue = useMemo(() => {
    const todayKey = new Date().toDateString();
    const assignedToday = new Set(
      assigned
        .filter((w) => new Date(w.created_at).toDateString() === todayKey)
        .map((w) => w.studentId)
    );
    return computeQueue(students, pendingApprovals, assignedToday);
  }, [students, pendingApprovals, assigned, tick]);

  // linha resumida do estado do dia (rodapé do card da fila)
  const briefingLine = useMemo(
    () =>
      briefingOffline({
        activeToday: stats.activeStudents,
        totalStudents: stats.totalStudents,
        missesWeek: stats.missesWeek,
        prescribedToday: stats.prescribedToday,
        pendingApprovals,
        worstStudent:
          students
            .filter((s) => s.lastTrainingDaysAgo >= 3)
            .sort((a, b) => b.lastTrainingDaysAgo - a.lastTrainingDaysAgo)[0]?.name ?? null,
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

  const openStudent = (studentId: string) => {
    const s = students.find((x) => x.id === studentId);
    if (s) setSheetStudent(s);
  };

  return (
    <div className="space-y-5">
      {/* Header: identidade do personal + sino com badge da fila */}
      <m.header variants={item} initial="hidden" animate="show" className="flex items-center gap-3">
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
          onClick={() => setQueueOpen(true)}
          aria-label={`Fila de hoje, ${queue.length} itens`}
          className="tactile relative flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {queue.length > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black text-brand-foreground">
              {queue.length}
            </span>
          ) : null}
        </button>
      </m.header>

      {/* Skeleton do primeiro load (imita o layout real) */}
      {students.length === 0 ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-[20px] bg-white/[0.04]" />
          ))}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      ) : null}

      {/* Fila de Hoje: card principal */}
      <m.section variants={item} initial="hidden" animate="show" aria-labelledby="queue-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="queue-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ListChecks className="h-4 w-4 text-brand" />
            Fila de hoje
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground">
            {queue.length} pendência{queue.length === 1 ? "" : "s"}
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-2xl border border-[#4ADE80]/25 bg-[#4ADE80]/[0.06] p-5 text-center">
            <TrophyIcon className="mx-auto mb-1.5 h-5 w-5 text-[#4ADE80]" />
            <p className="text-[12px] font-bold text-foreground">Tudo em dia, turma resolvida</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.slice(0, 4).map((q) => (
              <QueueRow key={q.id} item={q} onOpenStudent={openStudent} compact />
            ))}
            {queue.length > 4 ? (
              <button
                onClick={() => setQueueOpen(true)}
                className="tactile w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-brand"
              >
                Ver as outras {queue.length - 4} no sino
              </button>
            ) : null}
          </div>
        )}

        {/* resumo do dia no rodapé do card */}
        <p className="mt-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-[10.5px] leading-snug text-muted-foreground">
          {briefingLine}
        </p>
      </m.section>

      {/* Métricas de gestão (count-up) */}
      <m.div variants={item} initial="hidden" animate="show" className="grid grid-cols-3 gap-2">
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
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full origin-left rounded-full bg-brand transition-transform duration-700"
              style={{
                transform: `scaleX(${stats.totalStudents ? stats.activeStudents / stats.totalStudents : 0})`,
              }}
            />
          </div>
        </Link>
        <Link href="/personal/treinos" className="gf-card gf-glass !rounded-2xl !p-3 transition-transform active:scale-[0.97]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#4ADE80]/25 bg-[#4ADE80]/10">
            <ClipboardList className="h-3.5 w-3.5 text-[#4ADE80]" />
          </span>
          <p className="mt-2 font-display text-xl font-black leading-none text-foreground">
            <CountUp value={stats.prescribedToday} />
          </p>
          <p className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground">
            Prescritos hoje
          </p>
          {stats.prescribedYesterday > 0 ? (
            <p
              className={cn(
                "mt-0.5 text-[9px] font-bold",
                stats.prescribedToday >= stats.prescribedYesterday ? "text-[#4ADE80]" : "text-[#FFC24D]"
              )}
            >
              {stats.prescribedToday >= stats.prescribedYesterday ? "▲" : "▼"} ontem:{" "}
              {stats.prescribedYesterday}
            </p>
          ) : null}
        </Link>
        <Link href="/personal/alunos" className="gf-card gf-glass !rounded-2xl !p-3 transition-transform active:scale-[0.97]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#F87171]/25 bg-[#F87171]/10">
            <UserRoundX className="h-3.5 w-3.5 text-[#F87171]" />
          </span>
          <p className="mt-2 font-display text-xl font-black leading-none text-foreground">
            <CountUp value={stats.missesWeek} />
          </p>
          <p className="mt-1 text-[9.5px] font-semibold leading-tight text-muted-foreground">
            Faltas da semana
          </p>
          {stats.missesWeek > 0 ? (
            <p className="mt-0.5 text-[9px] font-bold text-[#F87171]">
              {Math.round((stats.missesWeek / Math.max(1, stats.totalStudents)) * 100)}% da turma
            </p>
          ) : null}
        </Link>
      </m.div>

      {/* Pulso da academia (mesmo componente do aluno) */}
      <m.div variants={item} initial="hidden" animate="show">
        <LivePulse online={online} />
      </m.div>

      {/* Gráfico de frequência semanal */}
      <m.section variants={item} initial="hidden" animate="show">
        <WeeklyChart students={students} />
      </m.section>

      {/* Agenda de hoje */}
      {agenda.length > 0 ? (
        <m.section variants={item} initial="hidden" animate="show" aria-labelledby="agenda-title">
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
                    <AvatarImage src={s.avatar ?? undefined} alt={s.name} />
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
        </m.section>
      ) : null}

      {/* Ações rápidas */}
      <m.section variants={item} initial="hidden" animate="show" aria-labelledby="quick-title">
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
      </m.section>

      {/* Sino: fila completa no bottom sheet */}
      <BottomSheet open={queueOpen} onClose={() => setQueueOpen(false)}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-brand" />
            <p className="text-base font-bold text-foreground">Fila de hoje</p>
            <span className="ml-auto rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
              {queue.length}
            </span>
          </div>
          {queue.map((q) => (
            <QueueRow key={q.id} item={q} onOpenStudent={(id) => { setQueueOpen(false); openStudent(id); }} />
          ))}
        </div>
      </BottomSheet>

      <StudentSheet student={sheetStudent} onClose={() => setSheetStudent(null)} />
    </div>
  );
}

const rowItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

/** Mini-gráfico de barras: check-ins por dia da semana (últimos 7 dias) */
function WeeklyChart({ students }: { students: PersonalStudent[] }) {
  const days = useMemo(() => {
    const result: { label: string; count: number; isToday: boolean }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const isToday = i === 0;
      // Simula check-ins baseado no padrão de atividade dos alunos
      const activeOnDay = students.filter((s) => {
        const dow = d.getDay();
        if (s.freq >= 5) return dow >= 1 && dow <= 5;
        if (s.freq >= 3) return [1, 3, 5].includes(dow);
        return dow === 1 || dow === 4;
      }).length;
      result.push({ label: dayNames[d.getDay()], count: activeOnDay, isToday });
    }
    return result;
  }, [students]);

  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="gf-card gf-glass !rounded-2xl !p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold text-foreground">Frequência da semana</p>
        <p className="text-[9px] text-muted-foreground">check-ins/dia</p>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {days.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[8px] font-bold text-muted-foreground">{d.count}</span>
            <div className="w-full overflow-hidden rounded-t-sm" style={{ height: 40 }}>
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-500",
                  d.isToday ? "bg-brand" : "bg-white/10"
                )}
                style={{
                  height: `${(d.count / maxCount) * 100}%`,
                  minHeight: d.count > 0 ? 4 : 0,
                }}
              />
            </div>
            <span
              className={cn(
                "text-[8px] font-bold",
                d.isToday ? "text-brand" : "text-muted-foreground/60"
              )}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueRow({
  item: queueItem,
  onOpenStudent,
  compact = false,
}: {
  item: QueueItem;
  onOpenStudent: (studentId: string) => void;
  compact?: boolean;
}) {
  const tone = TONE[queueItem.tone];
  const Icon =
    queueItem.tone === "red" ? CircleAlert : queueItem.tone === "amber" ? Flame : Trophy;

  const runAction = () => {
    if (queueItem.action.kind === "student") onOpenStudent(queueItem.action.studentId);
  };

  return (
    <m.article
      variants={rowItem}
      initial="hidden"
      animate="show"
      className={cn("gf-card gf-glass !p-3.5", tone.ring)}
    >
      <button
        onClick={runAction}
        className={cn("flex w-full items-start gap-3 text-left", queueItem.action.kind === "student" && "transition-transform active:scale-[0.985]")}
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", tone.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold leading-snug text-foreground">{queueItem.text}</p>
          {!compact ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{queueItem.detail}</p>
          ) : null}
        </div>
      </button>

      <div className="mt-2.5">
        {queueItem.action.kind === "whatsapp" ? (
          <a
            href={waHref(queueItem.action.phone, queueItem.action.text)}
            target="_blank"
            rel="noreferrer"
            className="tactile inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 text-[10.5px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.96]"
          >
            <MessageCircle className="h-3 w-3" />
            {queueItem.action.label}
          </a>
        ) : queueItem.action.kind === "link" ? (
          <Link
            href={queueItem.action.href}
            className="tactile inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand/15 px-3 text-[10.5px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.96]"
          >
            {queueItem.action.label}
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="tactile inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[10.5px] font-bold text-foreground ring-1 ring-white/[0.08]">
            {queueItem.action.label}
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </m.article>
  );
}
