"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { ChevronRight, ChevronDown, Activity, Award, Trophy, CheckCircle2, Gem, Crown, ArrowUpRight, ScanLine } from "lucide-react";
import { useReducedMotion } from "~/hooks/useReducedMotion";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList } from "~/components/common/AsyncStates";
import { cn } from "~/lib/utils";
import { calcStreak, weekdayName, startOfWeek } from "~/lib/utils/calculations";
import { cap } from "~/lib/utils/format";
import { leagueFor } from "~/lib/utils/leagues";
import { getTodayWorkout, type TodayWorkout } from "~/lib/today-workout";
import AiCoach from "~/components/ai/coach-chat";
import PersonalHome from "~/components/personal/PersonalHome";
import { LivePulse } from "~/components/dashboard/LivePulse";
import { StreakFlame, FlameStageHint } from "~/components/dashboard/StreakFlame";
import { PerformanceRing } from "~/components/dashboard/PerformanceRing";
import { HeroWorkout } from "~/components/dashboard/HeroWorkout";
import { titleFor } from "~/components/dashboard/TitlePoints";
import PartnerCarousel from "~/components/dashboard/PartnerCarousel";
import {
  isDemoMode,
  demoTreinoData,
  demoDestaquesAcademia,
  demoMundoFit,
  demoOnlineAgora,
  demoFallback,
} from "~/lib/demo-bridge";
import {
  inferGender,
  monthlyScore,
  nextWorkoutFromLogs,
} from "~/components/dashboard/mocks";
import type { WorkoutLogs, Leaderboard } from "~/lib/types/models";

const TIPS = [
  "Beba água antes do treino: hidratação vale até 20% da sua força.",
  "Aquecer 10 minutinhos antes evita lesão e melhora todo o treino.",
  "Durma 7 a 8 horas: é no sono que o músculo treinado cresce.",
  "Se não deu pra treinar ontem, retome hoje — o importante é não desistir.",
  "Aumente a carga aos poucos, a cada 2 semanas, para o músculo evoluir.",
  "Escolha um horário fixo: quem treina sempre no mesmo horário falta menos.",
  "Pós-treino: coma proteína e carbo em até 1 hora para se recuperar melhor.",
  "Fôlego é treino: a cada semana, tente mais 1 repetição no último exercício.",
];
const META_SEMANAL = 7; // mock: virá do onboarding (frequência escolhida pelo aluno)
const ME_ID = "00000000-0000-0000-0000-000000000099";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

const FOCUS_IMAGE: Record<string, string> = {
  perna: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
  peito: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80",
  costas: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80",
  ombro: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1200&q=80",
  braco: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80",
  abdomen: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80",
};

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return <span className="tabular-nums">{hh}:{mm}:{ss}</span>;
}

const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReduced()) {
      setVal(target);
      return;
    }
    let start: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* Celebração sutil ao bater marco (streak 7/30/100) */
function ConfettiBurst() {
  if (prefersReduced()) return null;
  const pieces = Array.from({ length: 26 }).map((_, i) => ({
    angle: (i / 26) * Math.PI * 2,
    dist: 42 + (i % 5) * 14,
    color: ["#F4711E", "#33D17A", "#FFC24D", "#F3F6FC", "#FF8A3C"][i % 5],
    size: 4 + (i % 3) * 2,
    rot: (i * 47) % 360,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-[2px]"
          style={{ width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist * 0.75 + 10,
            opacity: [1, 1, 0],
            rotate: p.rot,
          }}
          transition={{ duration: 1.1, ease: "easeOut", delay: (i % 4) * 0.05 }}
        />
      ))}
    </div>
  );
}

const LEAGUE_GLYPHS: Record<string, { Icon: typeof Trophy; color: string }> = {
  bronze: { Icon: Award, color: "#C98A4B" },
  prata: { Icon: Award, color: "#B8C4D8" },
  ouro: { Icon: Trophy, color: "#FFC24D" },
  platina: { Icon: Gem, color: "#67E8F9" },
  diamante: { Icon: Crown, color: "#F4711E" },
};

/** Troféu da liga com leve flutuação (pausa em motion reduzido). */
function LeagueGlyphMotion({ id }: { id: string }) {
  const glyph = LEAGUE_GLYPHS[id] ?? LEAGUE_GLYPHS.ouro;
  const Icon = glyph.Icon;
  const reduced = useReducedMotion();
  return (
    <Link href="/ranking" aria-label="Ver ranking da semana" className="tactile">
      <motion.span
        className="block"
        animate={
          reduced
            ? undefined
            : { y: [0, -5, 0], rotate: [0, -2.5, 2.5, 0], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 10px rgba(255,194,77,0.35))" }}
      >
        <Icon className="h-[28px] w-[28px]" style={{ color: glyph.color }} />
      </motion.span>
    </Link>
  );
}

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const demo = isDemoMode();
  const [showMore, setShowMore] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Check-in contextual: lido da MESMA fonte que a aba Check-in grava (localStorage por dia)
  const [isCheckedInToday] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try { return window.localStorage.getItem("gymfit_last_checkin") === key; } catch { return false; }
  });
  const heroRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isCheckedInToday && heroRef.current) {
      const t = setTimeout(() => heroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
      return () => clearTimeout(t);
    }
  }, [isCheckedInToday]);

  useEffect(() => {
    if (loading) return;
    // Gestor vai para o painel de gestão; Personal tem dashboard próprio abaixo.
    if (profile?.role === "manager" || profile?.role === "admin") router.replace("/dashboard");
  }, [profile?.role, loading, router]);



  const { data, loading: dataLoading } = useAsyncQuery<{
    logs: WorkoutLogs[];
    detailCount: number;
    points: number;
    rank: number;
  }>(
    async () => {
      if (demo) {
        const t = demoTreinoData();
        const ranks = (demoFallback("leaderboard") as Leaderboard[]) ?? [];
        const meIdx = ranks.findIndex((r) => r.student_id === ME_ID);
        return {
          data: {
            logs: t.logs as WorkoutLogs[],
            detailCount: t.details.length,
            points: meIdx >= 0 ? ranks[meIdx].points : 1980,
            rank: meIdx >= 0 ? meIdx + 1 : 1,
          },
          error: null,
        };
      }
      const supabase = supabaseBrowser();
      if (!user) return { data: null, error: { message: "Sessão indisponível" } };
      const [lRes, rRes] = await Promise.all([
        supabase.from("workout_logs").select("date, weight_kg, reps").eq("student_id", user.id).order("date", { ascending: false }).limit(60),
        supabase.from("leaderboard").select("points").eq("student_id", user.id).eq("gym_id", profile?.gym_id ?? "").eq("week_start", startOfWeek().toISOString()).eq("rank_type", "load").maybeSingle(),
      ]);
      const pts = (rRes.data as { points?: number } | null)?.points ?? 0;
      const rows = (lRes.data ?? []) as WorkoutLogs[];
      return {
        data: { logs: rows, detailCount: 0, points: pts, rank: 0 },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  // FONTE ÚNICA: no demo, o MESMO objeto de logs da aba Treino (singleton).
  const twSingleton = demo ? getTodayWorkout() : null;
  const logs = useMemo<WorkoutLogs[]>(() => (demo ? twSingleton!.logs : data?.logs ?? []), [demo, twSingleton, data]);
  const streak = useMemo(() => calcStreak(logs.map((l) => l.date)), [logs]);
  const sessionsWeek = useMemo(() => {
    const days = new Set();
    logs.forEach((l) => {
      const d = l.date.slice(0, 10);
      if (d >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)) days.add(d);
    });
    return days.size;
  }, [logs]);

  // Comparação semanal — treinos desta semana vs semana anterior
  const weekCompare = useMemo(() => {
    const day = 86400000;
    const now = Date.now();
    const weekStart = now - 6 * day;
    const prevStart = now - 13 * day;
    const prevEnd = now - 7 * day;
    let thisWeek = 0;
    let lastWeek = 0;
    logs.forEach((l) => {
      const t = new Date(l.date).getTime();
      if (t >= weekStart && t <= now) thisWeek++;
      else if (t >= prevStart && t <= prevEnd) lastWeek++;
    });
    return { thisWeek, lastWeek, delta: thisWeek - lastWeek };
  }, [logs]);

  // Volume por dia → 5 níveis de intensidade (GitHub-style)
  const monthDays = useMemo(() => {
    const vol = new Map<string, number>();
    logs.forEach((l) => {
      const k = l.date.slice(0, 10);
      vol.set(k, (vol.get(k) ?? 0) + (l.weight_kg ?? 0) * (l.reps ?? 1) || 1);
    });
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const vals = [...vol.entries()].filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).map(([, v]) => v);
    const max = Math.max(...vals, 1);
    const days: Array<{ day: number; key: string; level: number; today: boolean }> = [];
    const first = new Date(year, month, 1);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = date.toISOString().slice(0, 10);
      const v = vol.get(key) ?? 0;
      days.push({
        day: d,
        key,
        level: v > 0 ? Math.min(4, Math.max(1, Math.ceil((v / max) * 4))) : 0,
        today: date.toDateString() === now.toDateString(),
      });
    }
    return { firstWeekday: first.getDay(), days };
  }, [logs]);

  const today = new Date();
  const monthLabel = today.toLocaleDateString("pt-BR", { month: "long" });
  const dayNum = today.toLocaleDateString("pt-BR", { day: "2-digit" });
  const monthShort = today.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const weekdayShort = cap(weekdayName());
  const destaques = demo ? demoDestaquesAcademia() : [];
  const destaque = destaques[new Date().getDate() % Math.max(1, destaques.length)];
  const mundo = (demo ? demoMundoFit() : [])[0];
  const online = demo ? demoOnlineAgora() : 0;
  const tip = TIPS[new Date().getDate() % TIPS.length];

  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name = profile?.name?.split(" ")[0] ?? "Atleta";

  const myLeague = leagueFor(data?.points ?? 0);
  const myRank = data?.rank ?? 0;
  const titulo = titleFor(inferGender(profile?.name), monthlyScore.checkins, streak);

  const streakCount = useCountUp(streak);
  const exCount = useCountUp(data?.detailCount ?? 0);
  const rankCount = useCountUp(myRank);

  // Treino de hoje = próximo da SEQUÊNCIA da ficha (não decide por fadiga).
  // Se faltou um dia, retoma o treino perdido — é o que aparece no hero.
  // focus derivado da MESMA fonte — label idêntico ao da aba Treino
  const focusLabel = twSingleton ? twSingleton.focusLabel : nextWorkoutFromLogs(logs).label;
  const focusResume = twSingleton ? twSingleton.resume : nextWorkoutFromLogs(logs).resume;
  const todayLabel = `Treino do dia · ${focusLabel}`;
  const activeDays = monthDays.days.filter((d) => d.level > 0).length;
  const remaining = Math.max(0, META_SEMANAL - sessionsWeek);

  // Detalhe por dia do heatmap (#6): nº de séries + volume movido
  const dayStats = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    logs.forEach((l) => {
      const k = l.date.slice(0, 10);
      const cur = map.get(k) ?? { count: 0, volume: 0 };
      cur.count += 1;
      cur.volume += (l.weight_kg ?? 0) * (l.reps ?? 1);
      map.set(k, cur);
    });
    return map;
  }, [logs]);
  const selectedDetail = selectedDay ? dayStats.get(selectedDay) ?? null : null;

  // Aviso complementar de fadiga (não muda o treino sugerido)
  const fatigueNotice = focusResume
    ? "Você faltou ontem — este treino ficou pendente da ficha, segue de onde parou."
    : null;

  const isMilestone = streak >= 7 && (streak === 7 || streak === 30 || streak === 100 || streak % 7 === 0);
  const [firedMilestone, setFiredMilestone] = useState<string | null>(null);
  useEffect(() => {
    if (isMilestone && firedMilestone !== `${streak}`) setFiredMilestone(`${streak}`);
  }, [isMilestone, streak, firedMilestone]);
  const showConfetti = isMilestone && firedMilestone === `${streak}`;

  if (loading || (dataLoading && !demo)) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <SkeletonList rows={6} />
      </div>
    );
  }

  // Dashboard específico do Personal (mobile-first, sem anel/streak de aluno)
  if (profile?.role === "trainer") {
    return <PersonalHome />;
  }

  return (
      <div className="mx-auto max-w-md pb-32 pt-8">
        {/* CHECK-IN CONTEXTUAL: some após o check-in do dia; foco vai pro treino */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-4 pb-5">
          {isCheckedInToday ? (
            <span className="flex items-center justify-center gap-2 rounded-full border border-success/40 bg-success/12 px-4 py-2 text-[12px] font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Check-in feito · Treinando agora
            </span>
          ) : (
          <Link href="/checkin" className="tactile block rounded-2xl bg-[#F4711E] px-5 py-4 text-center shadow-[0_0_20px_rgba(244,113,30,0.4)]" style={{ willChange: "transform" }}>
            <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center justify-center gap-2.5 text-[15px] font-black text-black">
              <ScanLine className="h-5 w-5" />
              Cheguei na academia — fazer check-in
            </motion.span>
          </Link>
          )}
        </motion.div>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 px-4">
        {/* LINHA 1 — Logo + Saudação */}
        <motion.div variants={item} className="flex items-center justify-between gap-3 px-2">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/logo-academia.png"
              alt="GymFitness"
              width={128}
              height={40}
              priority
              unoptimized
              className="h-9 w-auto shrink-0 object-contain"
              style={{ filter: "drop-shadow(0 0 14px rgba(255,111,22,0.35))" }}
            />
            <div className="min-w-0">
              <h1 className="break-words font-display text-[24px] font-extrabold leading-[1.15] tracking-tight text-[#F4F6FB] md:text-[28px]">
                {greeting}, {name}
              </h1>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="pm-mono text-[12px] font-medium tracking-[0.08em] text-[#F4F6FB]">
              <LiveClock />
            </p>
            <p className="pm-mono mt-1 text-[#7E8AA0]">
              {weekdayShort} · {dayNum} {monthShort}
            </p>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <LivePulse online={online} />
        </motion.div>

        {/* COCKPIT — Anel da meta + Streak + Liga */}
        <motion.section variants={item} className="pm-surface overflow-hidden">
          <div className="px-2 pb-6 pt-1">
            <div className="relative">
              <PerformanceRing done={sessionsWeek} goal={META_SEMANAL} />
              {/* Pulse ring - lightweight visual feedback */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#FF6F16]/30"
                  animate={{ scale: [1, 1.02, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ borderRadius: "50%" }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 px-4">
              <span className={cn("h-1.5 w-1.5 rounded-full", remaining > 0 ? "bg-[#F4711E]" : "bg-[#4ADE80]")} />
              <p className="pm-mono text-[#8B95A9]">
                {remaining > 0
                  ? `${sessionsWeek} feitos esta semana · ${remaining} restam`
                  : "constância da semana garantida!"}
              </p>
            </div>

            {/* Streak + Liga — mesma vitrine, células respiradas */}
            <div className="mt-7 grid grid-cols-2 gap-3 px-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                initial={{ opacity: 0, scale: 0.85, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                className="relative flex flex-col items-center gap-1.5 overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-3 py-5 after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent"
              >
                {showConfetti ? <ConfettiBurst /> : null}
                <StreakFlame streak={streak} size={30} />
                <p className="pm-num mt-1 text-[26px] text-[#F4F6FB]">{streakCount}</p>
                <p className="text-[12px] font-medium text-[#7E8AA0]">dias seguidos</p>
                <FlameStageHint streak={streak} />
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                initial={{ opacity: 0, scale: 0.85, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.22 }}
                className="relative flex flex-col items-center gap-1.5 overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-3 py-5 after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent"
              >
                <LeagueGlyphMotion id={myLeague.id} />
                <p className="pm-num mt-1 text-[26px] text-[#F4F6FB]">
                  {myRank > 0 ? `${rankCount}º` : "—"}
                </p>
                <p className="text-[12px] font-medium text-[#7E8AA0]">{myLeague.label}</p>
                <Link href="/ranking" className="text-[11px] font-semibold text-brand">
                  ver classificação
                </Link>
              </motion.div>
            </div>

            {/* Título do mês consolidado como linha secundária da liga (#7) */}
            <p className="mt-4 text-center text-[11px] leading-snug text-[#7E8AA0]">
              Título do mês: <span className="font-semibold text-[#D6DCEC]">{titulo.label}</span>
              {titulo.nextLabel ? (
                <>
                  {" · "}próxima conquista: <span className="font-semibold text-[#FF9A5C]">{titulo.nextLabel}</span>
                </>
              ) : null}
            </p>
          </div>
        </motion.section>

        {/* TREINO DE HOJE — ação principal; recebe o scroll quando check-in feito */}
        <motion.div variants={item} ref={heroRef}>
          <HeroWorkout
            image={FOCUS_IMAGE[(twSingleton?.bodyCat) ?? ""] ?? "/workout/workout-hero.jpg"}
            title={todayLabel}
            exerciseCount={exCount}
            estMin={45}
            sessionsWeek={sessionsWeek}
            sessionLabel={focusResume ? "Retomando onde parou" : "Treino de hoje"}
            notice={fatigueNotice ?? undefined}
            ready
          />
        </motion.div>

        {/* VER MAIS — densidade controlada (#9): o essencial fica visível,
            o resto (ritmo detalhado, comunidade, artigo, dica, parceiros)
            fica a um toque de distância sem obrigar a rolar tudo. */}
        <motion.div variants={item}>
          <button
            onClick={() => {
              navigator.vibrate?.(15);
              setShowMore((v) => !v);
            }}
            aria-expanded={showMore}
            className="tactile flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/[0.06] bg-white/[0.02] py-3.5 text-[13px] font-semibold text-[#B8C4D8] transition-colors hover:border-[#FF9A5C]/30 hover:text-[#F4F6FB]"
          >
            {showMore ? "Ver menos" : "Ver mais"}
            <ChevronDown className={cn("h-4 w-4 text-[#FF9A5C] transition-transform duration-200", showMore && "rotate-180")} />
          </button>
        </motion.div>

        {showMore ? (
          <>
        <motion.section variants={item} className="pm-surface p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="pm-mono text-[#7E8AA0]">Ritmo do mês</p>
              <p className="mt-1 font-display text-[14px] font-semibold tracking-tight text-[#F4F6FB]">{cap(monthLabel)}</p>
            </div>
            <Link href="/progresso" className="pm-mono tactile flex items-center gap-1 text-[#FF9A5C]">
              detalhes <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-[6px]">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((w) => (
              <span key={w} className="pm-mono pb-1 text-center !text-[8px] text-[#6E7A90]">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[6px]">
            {Array.from({ length: monthDays.firstWeekday }).map((_, i) => (
              <span key={`empty-${i}`} className="h-8" aria-hidden />
            ))}
            {monthDays.days.map((d) => {
              const selected = selectedDay === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => {
                    navigator.vibrate?.(10);
                    setSelectedDay((prev) => (prev === d.key ? null : d.key));
                  }}
                  aria-label={`${d.day} de ${monthShort}${d.today ? ", hoje" : ""}`}
                  aria-pressed={selected}
                  className={cn(
                    "h-8 rounded-[6px] transition-all",
                    selected ? "ring-2 ring-white/70" : "",
                    d.today
                      ? "bg-[#4ADE80] shadow-[0_0_10px_rgba(74,222,128,0.55)]"
                      : d.level === 0
                        ? "bg-white/[0.05] hover:bg-white/[0.12]"
                        : d.level === 1
                          ? "bg-[#F4711E]/25 hover:bg-[#F4711E]/40"
                          : d.level === 2
                            ? "bg-[#F4711E]/45 hover:bg-[#F4711E]/60"
                            : d.level === 3
                              ? "bg-[#F4711E]/75 hover:bg-[#F4711E]/90"
                              : "bg-[#FF7A2F]"
                  )}
                />
              );
            })}
          </div>

          {/* Detalhe do dia tocado (#6) — o que aconteceu naquele dia */}
          {selectedDay ? (
            <div className="animate-fade-in mt-4 flex items-center justify-between rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#F4F6FB]">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="mt-0.5 text-[11px] text-[#7E8AA0]">
                  {selectedDetail
                    ? `${selectedDetail.count} ${selectedDetail.count === 1 ? "série registrada" : "séries registradas"}`
                    : "Dia de descanso"}
                </p>
              </div>
              {selectedDetail ? (
                <p className="pm-num shrink-0 text-[16px] text-[#FF9A5C]">
                  {Math.round(selectedDetail.volume).toLocaleString("pt-BR")} kg
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-center text-[10px] text-[#6E7A90]">Toque num dia para ver o que você treinou</p>
          )}

          {/* Legenda da escala de cor (#6) */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            {[
              { label: "Descanso", cls: "bg-white/[0.12]" },
              { label: "Leve", cls: "bg-[#F4711E]/25" },
              { label: "Moderado", cls: "bg-[#F4711E]/45" },
              { label: "Forte", cls: "bg-[#F4711E]/75" },
              { label: "Intenso", cls: "bg-[#FF7A2F]" },
              { label: "Hoje", cls: "bg-[#4ADE80]" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-[3px]", l.cls)} />
                <span className="text-[10px] font-medium text-[#8B95A9]">{l.label}</span>
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[#7E8AA0]">{activeDays} dias ativos no mês</p>
          </div>

          {/* comparação semanal */}
          <div className="mt-5 flex items-center justify-between rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#4ADE80]/25 bg-[#4ADE80]/10 text-[#4ADE80]">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <p className="pm-mono text-[10px] text-[#7E8AA0]">esta semana vs anterior</p>
                <p className="mt-1 pm-num text-[20px] text-[#F4F6FB]">
                  {weekCompare.thisWeek} <span className="pm-mono text-[11px] text-[#6E7A90]">feitos · {weekCompare.lastWeek} antes</span>
                </p>
              </div>
            </div>
            <span
              className={cn(
                "pm-mono rounded-full px-3 py-1.5 text-[10px] font-semibold",
                weekCompare.delta > 0
                  ? "bg-[#4ADE80]/15 text-[#4ADE80]"
                  : weekCompare.delta < 0
                    ? "bg-[#FF5E1A]/15 text-[#FF8A3C]"
                    : "bg-white/[0.06] text-[#8B95A9]"
              )}
            >
              {weekCompare.delta > 0
                ? `▲ +${weekCompare.delta}`
                : weekCompare.delta < 0
                  ? `▼ ${weekCompare.delta}`
                  : "estável"}
            </span>
          </div>
        </motion.section>

        {/* 5. MAIS PRA VOCÊ — carrossel horizontal (menos scroll vertical) */}
        <motion.section variants={item}>
          <p className="gf-section mb-2 px-1">Mais pra você</p>
          <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {mundo ? (
              <Link href="/feed" className="w-[80%] shrink-0 snap-start rounded-[18px] border border-border bg-card/50 p-4 transition-colors hover:border-brand/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand">{mundo.source}</p>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[#F4F6FB]">{mundo.title}</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{mundo.body}</p>
              </Link>
            ) : null}
            {destaque ? (
              <div className="w-[80%] shrink-0 snap-start rounded-[18px] border border-border bg-card/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-success">Destaque da galera</p>
                <p className="mt-1.5 line-clamp-3 text-[13px] font-medium leading-snug text-[#D6DCEC]">{destaque.text}</p>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{destaque.author}</p>
              </div>
            ) : null}
            <div className="w-[80%] shrink-0 snap-start rounded-[18px] border border-border bg-card/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-warning">Dica do dia</p>
              <p className="mt-1.5 line-clamp-3 text-[13px] font-medium leading-snug text-[#D6DCEC]">{tip}</p>
            </div>
            <Link href="/personals" className="w-[80%] shrink-0 snap-start rounded-[18px] border border-brand/35 bg-gradient-to-br from-brand/15 via-card to-card p-4 transition-colors hover:border-brand/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Personals da casa</p>
              <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[#F4F6FB]">Acelere com acompanhamento premium</p>
              <p className="mt-2 text-[11px] font-semibold text-brand">Ver personais →</p>
            </Link>
          </div>
        </motion.section>

        {/* Parceiros — agora dentro do "Ver mais" (antes poluía todas as telas) */}
        <PartnerCarousel />

        {/* Marcador de build — confirma visualmente que o app está atualizado */}
        <p className="text-center text-[10px] text-[#4A5568]">
          GymFitness · build 24/08 v6 ✓
        </p>
          </>
        ) : null}
      </motion.div>

      <AiCoach />
    </div>
  );
}