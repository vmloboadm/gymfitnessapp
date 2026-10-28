"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  CalendarDays,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  Lock,
  ScanLine,
  ArrowUpRight,
  KeyRound,
  ArrowDown,
  Link2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { useStudentWorkoutsRealtime } from "~/hooks/useRealtimeSubscriptions";
import { supabaseBrowser } from "~/lib/supabase/client";
import {
  startWorkoutSession,
  completeWorkoutSession,
  completeStaleSessions,
  getLastSessionNeedingFeedback,
  getActiveWorkoutSession,
  startCheckin,
  closeCheckinForSession,
  updateWorkoutSession,
  type ActiveSession,
  type StudentSession,
  type SessionMeta,
} from "~/lib/supabase/workout-session";
import WorkoutFeedbackSheet from "~/components/student/WorkoutFeedbackSheet";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import WorkoutInProgress from "~/components/common/WorkoutInProgress";
import dynamic from "next/dynamic";
const BodyMap = dynamic(() => import("~/components/body-map"), { ssr: false });
import { ImageLightbox } from "~/components/common/ImageLightbox";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { PersonalWorkouts } from "~/components/student/PersonalWorkouts";
import { groupByTecnica, tecnicaLabel, tecnicaHint, type PlanExercise } from "~/lib/workout-groups";
import { PendingApprovalBanner } from "~/components/student/PendingApprovalBanner";
import { ProvisionalTemplates } from "~/components/training/ProvisionalTemplates";
import { CardioQuickAdd } from "~/components/training/CardioQuickAdd";
import { fetchMyAssignedPlans } from "~/lib/gym-api";
import { AiCoach } from "~/components/ai/AiCoachLazy";
import { cn } from "~/lib/utils";
import { assetPath } from "~/lib/asset-path";
import { findInDatabase } from "~/lib/exercises-database";
import { libraryMatch } from "~/lib/demo-data";
import { toast } from "sonner";
import { enqueueOffline, isOffline } from "~/lib/offline-queue";
import { apiPath } from "~/lib/api-path";
import WorkoutSummary from "~/components/common/WorkoutSummary";
import { weekdayName } from "~/lib/utils/calculations";
import { localDayKey, localDayStartDaysAgoISO } from "~/lib/utils/local-date";
import { useWorkoutSession, elapsedSeconds, readSessionProgress, clearSessionProgress, isDayUnlocked, markDayUnlocked, clearDayUnlocked, MAX_SESSION_HOURS, TRAINING_GATE_OPEN } from "~/lib/workout-session";
import { checkDayPassword } from "~/lib/day-pass";
import { SessionClock } from "~/components/common/SessionClock";
import { nextWorkoutFromLogs } from "~/components/dashboard/mocks";
import { stableWorkoutLogId } from "~/lib/workout/log-id";
import { resolveTrainingDay } from "~/lib/workout/training-day";

/* mapa exercício→grupo para dados reais (categories canônicas) */
const DEMO_EX_GROUP_REAL: Record<string, string> = {
  "ex-demo-001": "peito",
  "ex-demo-002": "perna",
  "ex-demo-005": "costas",
  "ex-demo-006": "perna",
};
import { getTodayWorkout } from "~/lib/today-workout";
import { cap, formatDate } from "~/lib/utils/format";
import { isDemoMode, demoTreinoData, demoLib } from "~/lib/demo-bridge";
import type {
  Exercises,
  StudentWorkouts,
  WorkoutDays,
  WorkoutExercises,
  WorkoutLogs,
  WorkoutPrograms,
} from "~/lib/types/models";

type LastPerf = { weight: number | null; reps: number | null; date: string };

/** Última carga/reps registrada de cada exercício (até 120 dias). */
async function loadLastPerformance(studentId: string, exerciseIds: string[]): Promise<Record<string, LastPerf>> {
  const ids = [...new Set(exerciseIds)].filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const { data } = await supabaseBrowser()
      .from("workout_logs")
      .select("exercise_id, weight_kg, reps, date")
      .eq("student_id", studentId)
      .in("exercise_id", ids)
      .gte("date", localDayStartDaysAgoISO(120))
      .order("date", { ascending: false })
      .limit(300);
    const out: Record<string, LastPerf> = {};
    for (const r of (data ?? []) as Array<{ exercise_id: string; weight_kg: number | null; reps: number | null; date: string }>) {
      const prev = out[r.exercise_id];
      // a linha mais recente manda; se ela veio sem carga, usa a última com carga
      if (!prev) out[r.exercise_id] = { weight: r.weight_kg || null, reps: r.reps || null, date: r.date };
      else if (!prev.weight && r.weight_kg) out[r.exercise_id] = { ...prev, weight: r.weight_kg };
    }
    return out;
  } catch {
    return {};
  }
}

/** Melhor série feita: maior carga (empate: mais reps). Vira a linha do log. */
function bestDoneSet(sets: Array<{ reps?: string; weight?: string; done?: boolean }>): { reps: number; weight: number } | null {
  let best: { reps: number; weight: number } | null = null;
  for (const st of sets) {
    if (!st?.done) continue;
    const reps = Math.min(999, parseInt(String(st.reps ?? "").match(/\d+/)?.[0] ?? "0", 10) || 0);
    const w = parseFloat((String(st.weight ?? "").match(/\d+(?:[.,]\d+)?/)?.[0] ?? "0").replace(",", "."));
    const weight = Number.isFinite(w) ? Math.round(w * 10) / 10 : 0;
    if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) best = { reps, weight };
  }
  return best;
}

type TreinoDay = WorkoutExercises & { exercise: Exercises | null };

type TreinoData = {
  workouts: StudentWorkouts | null;
  program: WorkoutPrograms | null;
  details: TreinoDay[];
  logs: WorkoutLogs[];
  days: WorkoutDays[];
  completedSessionToday?: boolean;
  activeSessionToday?: boolean;
};

type FetchResult<T> = { data: T | null; error: { message: string } | null };

function errorResult<T>(message: string): FetchResult<T> {
  return { data: null, error: { message } };
}

/* categoria da biblioteca → grupo do mapa corporal */
const BODY_GROUP_OF: Record<string, string> = {
  peito: "peito", costas: "costas", ombro: "ombro", biceps: "braco", triceps: "braco",
  antebraco: "braco", perna: "perna", inferiores: "perna", panturrilha: "perna", gluteo: "perna",
  core: "abdomen", abdomen: "abdomen",
};

/* contagem de exercícios por grupo p/ o balão do mapa corporal */
const BODY_COUNTS: Record<string, number> = (() => {
  const CATS: Record<string, string[]> = {
    peito: ["peito"],
    costas: ["costas"],
    perna: ["inferiores"],
    ombro: ["ombro"],
    braco: ["biceps", "triceps", "antebraco"],
    abdomen: ["abdomen"],
  };
  const out: Record<string, number> = {};
  for (const [k, ids] of Object.entries(CATS)) {
    out[k] = demoLib
      .filter((c) => ids.includes(c.id))
      .reduce((a, c) => a + c.subs.reduce((acc, sub) => acc + sub.exercises.length, 0), 0);
  }
  return out;
})();

const GROUP_LABEL: Record<string, string> = {
  peito: "Peito", costas: "Costas", perna: "Pernas", ombro: "Ombros", braco: "Braços", abdomen: "Abdômen",
};

const GROUP_CATS: Record<string, string[]> = {
  peito: ["peito"], costas: ["costas"], perna: ["inferiores"], ombro: ["ombro"],
  braco: ["biceps", "triceps", "antebraco"], abdomen: ["abdomen"],
};

function groupExercises(grupo: string, limit = 6) {
  const ids = GROUP_CATS[grupo] ?? [];
  return demoLib
    .filter((c) => ids.includes(c.id))
    .flatMap((c) => c.subs.flatMap((sub) => sub.exercises))
    .slice(0, limit);
}

const IMG: string | null = "/workout/workout-strength.jpg";
const YT = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " execução")}`;
const UNS = (id: string) => `https://images.unsplash.com/${id}?w=300&h=300&fit=crop&q=70`;
const DEFAULT_DEMO_EX: Array<{ id: string; name: string; sets: number; reps: string; rest: number; info: string; tips?: string[] | null; imageUrl: string | null; videoUrl: string | null; thumbUrl: string | null; videoUrlMale: string | null; videoUrlFemale: string | null }> = [
  { id: "d1", name: "Supino Reto", sets: 4, reps: "10", rest: 90, imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqHkC2h0vB6PpTZ6wPJMs88U2ep-tRZoc2mx1FZbVREw&s=10", videoUrl: YT("Supino Reto"), info: "Empurre sem travar o cotovelo.", thumbUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqHkC2h0vB6PpTZ6wPJMs88U2ep-tRZoc2mx1FZbVREw&s=10", videoUrlMale: YT("Supino Reto"), videoUrlFemale: YT("Supino Reto") },
  { id: "d2", name: "Crucifixo com Halteres", sets: 3, reps: "12", rest: 60, imageUrl: IMG as string | null, videoUrl: YT("Crucifixo Halteres"), info: "Abra até a linha do peito e volte controlando.", thumbUrl: UNS("photo-1549060279-7e168fcee0c2"), videoUrlMale: YT("Crucifixo com Halteres"), videoUrlFemale: YT("Crucifixo com Halteres") },
  { id: "d3", name: "Desenvolvimento Militar", sets: 3, reps: "10", rest: 75, imageUrl: IMG as string | null, videoUrl: YT("Desenvolvimento Militar"), info: "Core firme, sem arco lombar.", thumbUrl: UNS("photo-1583454110551-21f2fa2afe61"), videoUrlMale: YT("Desenvolvimento Militar"), videoUrlFemale: YT("Desenvolvimento Militar") },
  { id: "d4", name: "Elevação Lateral", sets: 4, reps: "15", rest: 45, imageUrl: IMG as string | null, videoUrl: YT("Elevação Lateral"), info: "Cotovelos levemente flexionados.", thumbUrl: UNS("photo-1571019613454-1cb2f99b2d8b"), videoUrlMale: YT("Elevação Lateral"), videoUrlFemale: YT("Elevação Lateral") },
];

export default function TreinoHomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const demo = isDemoMode();
  const [summarySeconds, setSummarySeconds] = useState<number | null>(null);
  const [summaryStats, setSummaryStats] = useState<{ sets: number; volumeKg: number } | null>(null);
  const [_rpe, _setRpe] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [session, setSession] = useState<typeof DEFAULT_DEMO_EX | null>(null);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [libCat, setLibCat] = useState<string | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // Feedback do treino anterior: sessão concluída sem feedback → pede ao abrir
  const [pendingFeedback, setPendingFeedback] = useState<StudentSession | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (demo || !user?.id) return;
    let cancelled = false;
    (async () => {
      await completeStaleSessions(user.id);
      if (cancelled) return;
      const last = await getLastSessionNeedingFeedback(user.id);
      if (cancelled) return;
      if (last) {
        setPendingFeedback(last);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, user?.id]);

  const feedbackDateLabel = useMemo(() => {
    if (!pendingFeedback?.ended_at) return "anterior";
    const d = new Date(pendingFeedback.ended_at);
    const today = new Date().toDateString() === d.toDateString();
    if (today) return "de hoje";
    const y = new Date(Date.now() - 864e5).toDateString() === d.toDateString();
    if (y) return "de ontem";
    return `do dia ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }, [pendingFeedback]);

  const feedbackEstimateMin = useMemo(() => {
    if (!pendingFeedback) return null;
    const end = pendingFeedback.ended_at ? new Date(pendingFeedback.ended_at).getTime() : Date.now();
    const mins = Math.round((end - new Date(pendingFeedback.started_at).getTime()) / 60000);
    return mins > 5 && mins < 240 ? mins : null;
  }, [pendingFeedback]);

  useEffect(() => {
    setHasSavedProgress(!!readSessionProgress());
  }, [phase]);

  const { data, loading, error, refetch } = useAsyncQuery<TreinoData>(
    async (): Promise<FetchResult<TreinoData>> => {
      if (demo) {
        const base = demoTreinoData() as TreinoData;
        // FONTE ÚNICA: logs idênticos aos da home (mesmo objeto em memória)
        return { data: { ...base, logs: getTodayWorkout().logs as typeof base.logs }, error: null };
      }
      const supabase = supabaseBrowser();
      if (!user || !profile) return errorResult("Sessão indisponível");

      const { data: workouts, error: e1 } = await supabase
        .from("student_workouts")
        .select("*")
        .eq("student_id", user.id)
        .eq("status", "active")
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) return errorResult(e1.message);
      if (!workouts) {
        return { data: { workouts: null, program: null, details: [], logs: [], days: [] }, error: null };
      }

      const programId = (workouts as StudentWorkouts).program_id;
      const [programRes, daysRes, logsRes, sessionRes] = await Promise.all([
        supabase.from("workout_programs").select("id, name, objective").eq("id", programId).maybeSingle(),
        supabase.from("workout_days").select("id, name, day_order").eq("program_id", programId).order("day_order", { ascending: true }),
        supabase.from("workout_logs").select("date, exercise_id, weight_kg, reps").eq("student_id", user.id).gte("date", localDayStartDaysAgoISO(13)),
        supabase.from("workout_sessions").select("id, status").eq("student_id", user.id).in("status", ["active", "completed"]).gte("started_at", localDayStartDaysAgoISO(0)).order("started_at", { ascending: false }).limit(5),
      ]);

      if (programRes.error || daysRes.error || logsRes.error || sessionRes.error) {
        return errorResult(programRes.error?.message ?? daysRes.error?.message ?? logsRes.error?.message ?? sessionRes.error?.message ?? "Erro");
      }
      const sessionRows = (sessionRes.data ?? []) as Array<{ id: string; status: string }>;

      const days = (daysRes.data ?? []) as WorkoutDays[];
      let details: TreinoDay[] = [];
      if (days.length > 0) {
        const dayIds = days.map((d) => d.id);
        const weRes = await supabase.from("workout_exercises").select("*").in("day_id", dayIds).order("ord", { ascending: true });
        if (weRes.error) return errorResult(weRes.error.message);
        const we = (weRes.data ?? []) as WorkoutExercises[];
        const exIds = [...new Set(we.map((w) => w.exercise_id))];
        let exercises: Exercises[] = [];
        if (exIds.length > 0) {
          const exRes = await supabase.from("exercises").select("id, name, category, tips, muscles").in("id", exIds);
          if (exRes.error) return errorResult(exRes.error.message);
          exercises = (exRes.data ?? []) as Exercises[];
        }
        details = we.map((w) => ({
          ...w,
          exercise: exercises.find((e) => e.id === w.exercise_id) ?? null,
        }));
      }

      return {
        data: {
          workouts: workouts as StudentWorkouts,
          program: (programRes.data as WorkoutPrograms | null) ?? null,
          details,
          logs: (logsRes.data ?? []) as WorkoutLogs[],
          days,
          completedSessionToday: sessionRows.some((r) => r.status === "completed"),
          activeSessionToday: sessionRows.some((r) => r.status === "active"),
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo],
    { enabled: !authLoading && !!user }
  );

  // Realtime: só refaz a query fora da sessão ativa. Enquanto o aluno está
  // treinando, um evento de OUTRO aluno não pode recarregar e desmontar a tela.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useStudentWorkoutsRealtime(profile?.gym_id, () => {
    if (phaseRef.current === "active") return;
    void refetch();
    if (user?.id && profile?.gym_id) {
      fetchMyAssignedPlans(user.id, profile.gym_id)
        .then((rows) => setPlanActive(rows))
        .catch(() => {});
    }
  });

  const router = useRouter();
  const { session: daySession, start: startDaySession, end: endDaySession } = useWorkoutSession();

  // Check-in do dia: liberou (senha/QR/NFC) → conteúdo visível até a meia-noite
  const [dayUnlockedLocal, setDayUnlockedLocal] = useState(false);
  useEffect(() => {
    setDayUnlockedLocal(isDayUnlocked());
  }, [phase, data?.workouts?.id]);

  // PLANO DO PERSONAL (produção): treino de hoje vem do student_workouts ativo
  const [planActive, setPlanActive] = useState<Awaited<ReturnType<typeof fetchMyAssignedPlans>>> ([]);
  const [planExerciseMap, setPlanExerciseMap] = useState<Record<string, { workoutId: string; exerciseId: string; reps: string; rpe: number | null }>>({});
  const [planTodayActive, setPlanTodayActive] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  // Sessão DB ativa que barrou um início: em vez de toast sem saída, abre
  // retomada (continuar de onde parou ou encerrar e começar o novo).
  const [blockedSession, setBlockedSession] = useState<ActiveSession | null>(null);
  const pendingStartRef = useRef<
    { kind: "plan"; dayIdx: number } | { kind: "template"; tpl: TemplateInput } | null
  >(null);
  useEffect(() => {
    if (demo || !user || !profile?.gym_id) return;
    fetchMyAssignedPlans(user.id, profile.gym_id)
      .then((rows) => setPlanActive(rows))
      .catch(() => setPlanActive([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, user?.id, profile?.gym_id]);

  // Checks dos slots do plano ativo (hook no topo: nunca após early return)
  const activeProgramId = planActive[0]?.programId ?? null;
  const { data: slotChecks, refetch: refetchSlotChecks } = useAsyncQuery<Array<{ slot: string; checked_at: string }>>(
    async () => {
      if (demo || !user || !profile?.gym_id || !activeProgramId) return { data: [], error: null };
      const { data: rows, error } = await supabaseBrowser()
        .from("slot_checks")
        .select("slot, checked_at")
        .eq("student_id", user.id)
        .eq("program_id", activeProgramId)
        .order("checked_at", { ascending: false })
        .limit(60);
      if (error) return { data: null, error };
      return { data: (rows ?? []) as Array<{ slot: string; checked_at: string }>, error: null };
    },
    [demo, user?.id, profile?.gym_id, activeProgramId],
    { enabled: !loading && !!user }
  );

  const programRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    const ir = new URLSearchParams(window.location.search).get("ir");
    if (ir === "hoje" && programRef.current) {
      const to = setTimeout(() => programRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
      return () => clearTimeout(to);
    }
  }, [loading]);

  // Retorno em 1 toque (?resume=1 da barrinha viva e da home): volta sozinho
  // ao treino em andamento, sem pedir nada.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (loading || resumedRef.current || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("resume") !== "1") return;
    resumedRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (phase !== "idle") return;
    try {
      const saved = readSessionProgress();
      if (daySession || (saved?.exercises ?? []).length > 0) resumeSession();
    } catch { /* fica no idle */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, daySession]);

  // Início em 1 toque vindo da Home (?start=1): abre direto a execução do
  // treino sugerido, sem o aluno ter que tocar em "Iniciar" de novo.
  const startPlanRef = useRef<((idx?: number) => void) | null>(null);
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (loading || autoStartRef.current || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("start") !== "1") return;
    // espera os checks da rotação: sem eles o sugerido cairia sempre no A
    if (planActive.length === 0 || !startPlanRef.current || slotChecks == null) return;
    autoStartRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (phase !== "idle") return;
    if (daySession || (readSessionProgress()?.exercises ?? []).length > 0) {
      resumeSession();
      return;
    }
    startPlanRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, planActive, phase, daySession, slotChecks]);

  // dia LOCAL de São Paulo (UTC quebrava treino após 21h: caía no dia seguinte)
  const todayKey = localDayKey(new Date());
  const dayOf = (iso: string) => localDayKey(iso);
  const plan = planActive[0] ?? null;
  // MESMA resposta que a Home usa. daysSelected manda; rotação só sem dias fixos.
  const trainingDay = useMemo(
    () =>
      demo
        ? null
        : resolveTrainingDay({
            plan,
            today: new Date(),
            logs: data?.logs ?? [],
            slotChecks: slotChecks ?? [],
            fallbackDays: profile?.available_days ?? undefined,
          }),
    [demo, plan, data?.logs, slotChecks, profile?.available_days]
  );
  const scheduledDayId =
    trainingDay?.status === "scheduled" ? data?.days?.[trainingDay.dayIdx]?.id ?? null : null;
  const suggestedIdx =
    trainingDay?.status === "scheduled" ? trainingDay.dayIdx : trainingDay?.optionalDayIdx ?? 0;
  const dayDetails = useMemo(() => {
    if (demo) return data?.details ?? [];
    if (!scheduledDayId) return [];
    return (data?.details ?? []).filter((d) => d.day_id === scheduledDayId);
  }, [demo, data?.details, scheduledDayId]);
  // MESMA FONTE da home, nunca diverge
  const tw = useMemo(() => (demo ? getTodayWorkout() : resolveFromLogs(data?.logs ?? [])), [demo, data?.logs, data?.details]);
  function resolveFromLogs(logs: NonNullable<TreinoData["logs"]>) {
    const f = nextWorkoutFromLogs(logs);
    const lastTrained: Record<string, string | null> = {};
    // grupo muscular real de cada exercício (categoria da biblioteca). Antes
    // só reconhecia ids de demonstração e o mapa ficava sempre "descansado".
    const catById: Record<string, string> = {};
    for (const d of data?.details ?? []) {
      const c = BODY_GROUP_OF[(d.exercise?.category ?? "").toLowerCase()];
      if (d.exercise_id && c) catById[d.exercise_id] = c;
    }
    for (const l of logs as Array<NonNullable<TreinoData["logs"]>[number] & { exercise_id?: string }>) {
      const cat = catById[l.exercise_id ?? ""] ?? DEMO_EX_GROUP_REAL[l.exercise_id ?? ""] ?? null;
      if (!cat) continue;
      if (!lastTrained[cat] || l.date > (lastTrained[cat] ?? "")) lastTrained[cat] = l.date;
    }
    return { focusLabel: String(f.label), resume: !!f.resume, bodyCat: String(f.bodyCat), label: `Treino do dia · ${String(f.label)}`, lastTrained };
  }
  // "Concluído hoje" só conta os exercícios DO PLANO DE HOJE (os details),
  // não logs de qualquer exercício: fazer o slot A não podia travar o B.
  const detailsIds = useMemo(
    () => new Set((dayDetails as Array<{ exercise_id?: string | null }>).map((d) => d.exercise_id).filter(Boolean)),
    [dayDetails]
  );
  const todayLogs = useMemo(
    () =>
      (data?.logs ?? []).filter(
        (l) => dayOf(l.date) === todayKey && (detailsIds.size === 0 || detailsIds.has((l as { exercise_id?: string }).exercise_id))
      ).length,
    [data, todayKey, detailsIds]
  );
  const totalToday = dayDetails.length;
  const finishedToday = !daySession && !data?.activeSessionToday && (totalToday > 0 && todayLogs > 0 || !!data?.completedSessionToday);



  const normExName = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();

  // Fonte primária de exercise_id: os details do plano ativo JÁ carregados
  // (sem query extra, sem depender de ilike). O ilike na biblioteca virou
  // fallback. Antes, nomes do plano que não casavam 1:1 com a biblioteca
  // derrubavam as linhas em silêncio e o treino nunca era registrado.
  const detailsExerciseId = (name: string): string | null => {
    const n = normExName(name);
    if (!n) return null;
    const det = (data?.details ?? []) as Array<{
      exercise_id?: string | null;
      exercise?: { name?: string | null } | null;
      notes?: string | null;
    }>;
    const exact = det.find(
      (d) =>
        normExName(d.exercise?.name ?? "") === n ||
        normExName((d.notes ?? "").split(".")[0] ?? "") === n
    );
    if (exact?.exercise_id) return exact.exercise_id;
    const fuzzy = det.find((d) => {
      const dn = normExName(d.exercise?.name ?? "");
      return dn.length > 0 && (dn.includes(n) || n.includes(dn));
    });
    return fuzzy?.exercise_id ?? null;
  };

  // Se o app foi fechado depois de finalizar e antes da rede confirmar, o
  // progresso bruto ainda está aqui. Recoloca na fila em vez de perder.
  useEffect(() => {
    if (demo || !data || !user || !profile || daySession) return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem("gymfit_session_progress_v1");
    } catch {
      return;
    }
    if (!raw) return;
    let saved: {
      exercises?: Array<{ id?: string; name?: string; exerciseId?: string | null }>;
      sessionStartedAt?: number | null;
      progress?: Record<string, { sets?: Array<{ reps?: string; weight?: string; done?: boolean }> }>;
      savedAt?: number;
    } | null = null;
    try {
      saved = JSON.parse(raw);
    } catch {
      clearSessionProgress();
      return;
    }
    const progress = saved?.progress ?? {};
    const ids = Object.keys(progress).filter((id) =>
      (progress[id]?.sets ?? []).some((s) => s?.done)
    );
    if (ids.length === 0) {
      clearSessionProgress();
      return;
    }
    void (async () => {
      let queued = 0;
      // mesmo id do salvamento por exercício: o que já entrou não duplica
      const key = `${user.id}:${saved?.sessionStartedAt ?? todayKey}`;
      for (const id of ids) {
        const ex = (saved?.exercises ?? []).find((x) => x.id === id);
        if (!ex?.name) continue;
        const exerciseId = ex.exerciseId ?? planExerciseMap[id]?.exerciseId ?? detailsExerciseId(ex.name);
        if (!exerciseId) continue;
        const best = bestDoneSet(progress[id]?.sets ?? []);
        if (!best) continue;
        const workoutId = planExerciseMap[id]?.workoutId || planActive[0]?.id || null;
        const row = {
          id: await logIdFor(key, exerciseId, String(workoutId ?? "")),
          gym_id: profile.gym_id,
          student_id: user.id,
          workout_id: workoutId,
          workout_session_id: null,
          exercise_id: exerciseId,
          date: new Date(saved?.savedAt ?? Date.now()).toISOString(),
          weight_kg: best.weight,
          reps: best.reps,
          rpe: null,
        };
        if (enqueueOffline("workout_logs", row)) queued++;
      }
      if (queued > 0) clearSessionProgress();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, data, daySession, user?.id, profile?.gym_id, planActive, todayKey]);

  // trava anti duplo-toque: finalizar duas vezes gerava log duplicado
  const activeSessionIdRef = useRef<string | null>(null);
  // Check-in já abre a sessão no banco. Guarda o id para o feedback do
  // resumo mesmo se o aluno finalizar sem escolher a ficha.
  useEffect(() => {
    if (demo || !daySession || !user?.id) return;
    let alive = true;
    getActiveWorkoutSession(user.id)
      .then((s) => { if (alive && s) activeSessionIdRef.current = s.id; })
      .catch(() => {});
    return () => { alive = false; };
  }, [demo, daySession, user?.id]);

  // Chave estável da sessão (início local do treino): a mesma no salvamento
  // por exercício e no final, inclusive depois de recarregar a página.
  const sessionKey = () => `${user?.id ?? "anon"}:${daySession?.startedAt ?? todayKey}`;
  const logIdFor = (key: string, exerciseId: string, workoutId: string) =>
    stableWorkoutLogId([key, user?.id ?? "", exerciseId, workoutId, todayKey]);

  // Salva o exercício NA HORA em que o aluno fecha as séries dele. Antes tudo
  // esperava o "Finalizar": fechou o app, acabou a bateria ou o finalizar
  // falhou, e o treino inteiro sumia do histórico.
  const savedExRef = useRef<Set<string>>(new Set());
  const persistExercise = async (
    ex: { id: string; name: string; reps?: string; exerciseId?: string | null },
    sets: Array<{ reps?: string; weight?: string; done?: boolean }>
  ) => {
    if (demo || !user?.id || !profile?.gym_id) return;
    const best = bestDoneSet(sets);
    if (!best) return;
    const m = planExerciseMap[ex.id];
    const exerciseId = ex.exerciseId ?? m?.exerciseId ?? detailsExerciseId(ex.name);
    if (!exerciseId) return;
    const key = sessionKey();
    const workoutId = m?.workoutId || null;
    const id = await logIdFor(key, exerciseId, String(workoutId ?? ""));
    if (savedExRef.current.has(id)) return;
    const row = {
      id,
      gym_id: profile.gym_id,
      student_id: user.id,
      workout_id: workoutId,
      workout_session_id: activeSessionIdRef.current,
      exercise_id: exerciseId,
      date: new Date().toISOString(),
      weight_kg: best.weight,
      reps: best.reps || Math.min(999, parseInt(String(ex.reps ?? "").match(/\d+/)?.[0] ?? "0", 10) || 0),
      rpe: m?.rpe ?? null,
    };
    savedExRef.current.add(id);
    if (isOffline()) {
      enqueueOffline("workout_logs", row);
      return;
    }
    // Grava só se ainda não existe: o id é estável por sessão/exercício.
    const { error } = await supabaseBrowser()
      .from("workout_logs")
      .upsert(row as never, { onConflict: "id", ignoreDuplicates: true });
    if (error && error.code !== "23505") {
      savedExRef.current.delete(id);
      enqueueOffline("workout_logs", row);
    }
  };

  const concludingRef = useRef(false);

  const conclude = async (
    completedIds?: string[],
    progressMap?: Record<string, { sets?: Array<{ reps?: string; weight?: string; done?: boolean }> }>
  ) => {
    if (concludingRef.current) return;
    concludingRef.current = true;
    setSummarySeconds(daySession ? elapsedSeconds(daySession.startedAt, Date.now()) : 0);
    const parseReps = (r: string): number => {
      const m = String(r ?? "").match(/\d+/);
      return m ? Math.min(999, parseInt(m[0], 10)) : 0;
    };
    // ids: parâmetro → ref ao vivo → progresso persistido (fallback triplo)
    let ids = completedIds?.length ? completedIds : [...completedRef.current];
    if (ids.length === 0) {
      try {
        const saved = readSessionProgress();
        const prog = (saved?.progress ?? {}) as Record<string, { sets?: Array<{ done?: boolean }> }>;
        ids = Object.entries(prog)
          .filter(([, v]) => (v.sets ?? []).length > 0 && (v.sets ?? []).every((s) => s.done))
          .map(([k]) => k);
      } catch { /* sem fallback */ }
    }
    // progresso real digitado pelo aluno (reps/peso por série)
    const progMap: Record<string, { sets?: Array<{ reps?: string; weight?: string; done?: boolean }> }> =
      progressMap ?? {};
    // registra TODO exercício com pelo menos 1 série feita (não só 100% completo:
    // fazer 2 de 3 séries e finalizar É treino, e antes virava "registrado" sem log)
    const loggedIds = Array.from(new Set([
      ...ids,
      ...Object.entries(progMap)
        .filter(([, v]) => (v.sets ?? []).some((s) => s?.done))
        .map(([k]) => k),
    ]));
    // snapshot das exercícios ANTES de limpar: no reload da página o state
    // `session` volta null e sem a lista nenhum exercise_id resolve (o log
    // ficava de "não entrou no histórico" mesmo com séries marcadas)
    const savedProgress = (() => {
      try {
        return readSessionProgress();
      } catch {
        return null;
      }
    })();
    const savedExList = (savedProgress?.exercises ?? []) as Array<{ id?: string; name?: string }>;
    const savedAt = savedProgress?.savedAt ?? Date.now();
    setConcludedCount(loggedIds.length || ids.length);
    {
      // séries feitas e volume (kg × reps) para o resumo
      let sets = 0;
      let vol = 0;
      for (const v of Object.values(progMap)) {
        for (const st of v.sets ?? []) {
          if (!st?.done) continue;
          sets++;
          const w = parseFloat(String(st.weight ?? "").replace(",", "."));
          if (Number.isFinite(w) && w > 0) vol += w * parseReps(st.reps ?? "");
        }
      }
      setSummaryStats({ sets, volumeKg: Math.round(vol) });
    }
    if (loggedIds.length) {
      setDoneIds((prev) => new Set([...prev, ...loggedIds]));
    }

    // 1) O resumo aparece AGORA. Nada de esperar rede para encerrar a tela:
    // o cronômetro congela, a sessão local fecha e a persistência segue em
    // segundo plano (com outbox se a conexão cair).
    setSummarySeconds(daySession ? elapsedSeconds(daySession.startedAt, Date.now()) : 0);
    setFinishedSessionId(activeSessionIdRef.current);
    const sessSnapshot = session;
    const sessionKeySnapshot = sessionKey();
    const slotSnapshot = activeSlot;
    const planSnapshot = planActive[0] ?? null;
    const profileSnapshot = profile;
    endDaySession();
    clearDayUnlocked();
    // O progresso bruto fica no aparelho até a persistência confirmar. Se o
    // app fechar no meio, a recuperação abaixo recoloca o treino na fila.
    try {
      localStorage.removeItem("gymfit_session_slot_v1");
    } catch { /* ok */ }
    window.dispatchEvent(new Event("gymfit-workout-finished"));
    window.dispatchEvent(new Event("gymfit-checkin-updated"));
    setPhase("done");
    navigator.vibrate?.([60, 40, 90]);
    toast("Treino finalizado", { description: "Seu resumo já está aqui." });

    // 2) Persistência em background. Só diz "registrado" quando entra de
    // verdade; qualquer falha vira fila offline.
    if (!demo && user?.id) {
      void (async () => {
        const active = isOffline()
          ? null
          : await getActiveWorkoutSession(user.id).catch(() => null);
        const sessionId = active?.id ?? activeSessionIdRef.current;
        setFinishedSessionId(sessionId);
        // Fecha a presença e a sessão juntas. Offline vira item da fila.
        let checkinClosed = false;
        if (!isOffline()) {
          checkinClosed = await closeCheckinForSession(sessionId).catch(() => false);
        }
        if (!checkinClosed && profileSnapshot) {
          void enqueueOffline("checkins", {
            id: await stableWorkoutLogId([
              "saida",
              user.id,
              sessionId ?? String(savedAt),
              todayKey,
            ]),
            gym_id: profileSnapshot.gym_id,
            student_id: user.id,
            type: "saida",
            source: "app",
            checked_at: new Date().toISOString(),
            workout_session_id: sessionId,
          });
        }
        // Fecha a sessão do banco. Se o aluno iniciar outro treino em seguida,
        // a trava não encontra uma sessão fantasma.
        if (!isOffline()) await completeWorkoutSession(user.id).catch(() => {});
        let inserted = 0;
        let queuedOffline = 0;
        let queuedTotal = 0;
        if (loggedIds.length && profileSnapshot) {
          let logRows: Array<Record<string, unknown>> = [];
          let slotRow: Record<string, unknown> | null = null;
          try {
            const supabase = supabaseBrowser();
            const offline = isOffline();
            const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();
            const sessList = (sessSnapshot ?? savedExList) as Array<{ id?: string; name: string; reps?: string }>;
            const missing = loggedIds.filter(
              (id) => !(planExerciseMap && planExerciseMap[id]?.exerciseId)
            );
            const detailIds: Record<string, string> = {};
            const stillMissing = missing.filter((id) => {
              const s = sessList.find((x) => x.id === id);
              const resolved = s ? detailsExerciseId(s.name) : null;
              if (resolved) {
                detailIds[id] = resolved;
                return false;
              }
              return true;
            });
            const nameToId: Record<string, string> = {};
            if (stillMissing.length > 0 && !offline) {
              const names = stillMissing.map((id) => sessList.find((s) => s.id === id)?.name).filter(Boolean) as string[];
              if (names.length > 0) {
                const orFilter = names.map((n) => `name.ilike.%${n.replace(/[%_,]/g, "").slice(0, 24)}%`).join(",");
                const { data: found } = await supabase
                  .from("exercises")
                  .select("id, name")
                  .or(orFilter)
                  .limit(names.length * 3);
                for (const f of (found ?? []) as Array<{ id: string; name: string }>) {
                  if (!nameToId[norm(f.name)]) nameToId[norm(f.name)] = f.id;
                }
              }
            }
            const findId = (name: string): string | null => {
              const n = norm(name);
              const words = n.split(" ").filter(Boolean);
              for (const [k, v] of Object.entries(nameToId)) {
                if (k.includes(n) || n.includes(k)) return v;
              }
              for (const [k, v] of Object.entries(nameToId)) {
                if (words.slice(0, 2).every((w) => k.includes(w))) return v;
              }
              return null;
            };
            const rows = loggedIds.flatMap((id) => {
              const m = planExerciseMap?.[id];
              const s = sessList.find((x) => x.id === id);
              const exerciseId = (s as { exerciseId?: string | null } | undefined)?.exerciseId ?? m?.exerciseId ?? detailIds[id] ?? (s ? findId(s.name) : null);
              if (!exerciseId) return [];
              const best = bestDoneSet(progMap[id]?.sets ?? []);
              const realReps = best && best.reps > 0
                ? best.reps
                : m?.reps
                  ? parseReps(m.reps)
                  : parseReps(s?.reps ?? "0");
              const realWeight = best ? best.weight : null;
              return [{
                gym_id: profileSnapshot.gym_id,
                student_id: user.id,
                workout_id: m?.workoutId || null,
                workout_session_id: sessionId,
                exercise_id: exerciseId,
                date: new Date().toISOString(),
                weight_kg: realWeight ?? 0,
                reps: realReps,
                rpe: m?.rpe ?? null,
              }];
            });
            logRows = await Promise.all(rows.map(async (row) => ({
              ...row,
              // mesmo id do salvamento por exercício durante o treino:
              // o que já entrou vira conflito (23505) e não duplica
              id: await logIdFor(sessionKeySnapshot, String(row.exercise_id ?? ""), String(row.workout_id ?? "")),
            })));
            const programId = planSnapshot?.programId;
            slotRow = slotSnapshot && programId
              ? {
                  id: await stableWorkoutLogId([
                    "slot",
                    user.id,
                    programId,
                    slotSnapshot,
                    todayKey,
                  ]),
                  gym_id: profileSnapshot.gym_id,
                  student_id: user.id,
                  program_id: programId,
                  slot: slotSnapshot,
                }
              : null;
            if (logRows.length > 0) {
              if (offline) {
                queuedOffline = logRows.filter((r) => enqueueOffline("workout_logs", r)).length;
                queuedTotal = logRows.length;
                if (slotRow) enqueueOffline("slot_checks", slotRow);
              } else {
                // Insere linha a linha: um conflito não pode derrubar o lote
                // inteiro (o aluno perderia todos os exercícios do dia).
                const failedRows: Array<Record<string, unknown>> = [];
                for (const row of logRows) {
                  // Já salvo por exercício durante o treino: ignora em vez de dar 409.
                  const { error: logErr } = await supabase
                    .from("workout_logs")
                    .upsert(row as never, { onConflict: "id", ignoreDuplicates: true });
                  if (!logErr || logErr.code === "23505") inserted++;
                  else failedRows.push(row);
                }
                if (inserted > 0) {
                  if (slotRow) {
                    const { data: already } = await supabase
                      .from("slot_checks")
                      .select("id")
                      .eq("student_id", user.id)
                      .eq("program_id", String(slotRow.program_id))
                      .eq("slot", String(slotRow.slot))
                      .gte("checked_at", localDayStartDaysAgoISO(0))
                      .limit(1);
                    if (!already?.length) {
                      await supabase.from("slot_checks").insert(slotRow as never).then(() => {});
                    }
                  }
                  const totalVolumeKg = logRows.reduce((sum, r) => {
                    const w = typeof r.weight_kg === "number" ? r.weight_kg : null;
                    const reps = typeof r.reps === "number" ? r.reps : 0;
                    return w && reps ? sum + w * reps : sum;
                  }, 0);
                  void supabase.auth
                    .getSession()
                    .then(({ data: sess }) => {
                      const token = sess.session?.access_token;
                      if (!token) return null;
                      return fetch(apiPath("/api/notify/workout-done"), {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          workoutName: planSnapshot?.name ?? data?.program?.name ?? undefined,
                          exerciseCount: inserted,
                          ...(totalVolumeKg > 0 ? { totalVolumeKg } : {}),
                        }),
                      });
                    })
                    .catch(() => {});
                }
                if (failedRows.length > 0) {
                  queuedOffline = failedRows.filter((r) => enqueueOffline("workout_logs", r)).length;
                  queuedTotal = logRows.length;
                  if (slotRow) enqueueOffline("slot_checks", slotRow);
                }
              }
            }
          } catch {
            if (logRows.length > 0) {
              queuedOffline = logRows.filter((r) => enqueueOffline("workout_logs", r)).length;
              queuedTotal = logRows.length;
              if (slotRow) enqueueOffline("slot_checks", slotRow);
            }
          }
        }

        // Persistiu (no banco ou na fila do aparelho): limpa o rascunho local
        // para a recuperação não reenviar o mesmo treino.
        if (inserted > 0 || queuedOffline > 0) clearSessionProgress();

        const failedToPersist =
          !!profileSnapshot && loggedIds.length > 0 && inserted === 0 && queuedOffline === 0;
        if (failedToPersist) {
          toast.error("Treino finalizado, mas não entrou no histórico", {
            description: "Vamos tentar de novo quando você abrir o treino. Se não aparecer, fale com seu personal.",
          });
        } else if (inserted > 0) {
          toast.success(`Treino registrado! ${inserted} exercício${inserted === 1 ? "" : "s"} no histórico.`);
        } else if (queuedOffline > 0) {
          if (queuedTotal > queuedOffline) {
            toast.error("O aparelho guardou só parte do treino", {
              description: "O que foi salvo sincroniza quando a conexão voltar.",
            });
          } else {
            toast("Treino guardado no aparelho", {
              description: "Sincroniza quando a conexão voltar.",
            });
          }
        }

      })();
    } else if (demo) {
      toast.success("Treino registrado!");
    }
    concludingRef.current = false;
  };

  // Volta ao treino em andamento (mesma sessão, progresso restaurado pela
  // lista salva; o componente de execução recarrega as séries marcadas).
  const resumeSession = () => {
    try {
      const saved = readSessionProgress();
      const list = (saved?.exercises ?? []) as Array<{ id?: string }>;
      if (list.length > 0) {
        setSession(list as typeof DEFAULT_DEMO_EX);
        setActiveTotal(list.length);
        try {
          const slotRaw = localStorage.getItem("gymfit_session_slot_v1");
          const parsed = slotRaw ? (JSON.parse(slotRaw) as { slot?: string }) : null;
          if (parsed?.slot && parsed.slot !== "TMP") setActiveSlot(parsed.slot);
        } catch { /* sem slot: grava exercícios, sem check */ }
        setPlanTodayActive(true);
        setPhase("active");
        return;
      }
    } catch { /* cai no início sugerido */ }
    if (plan && dias.length > 0) {
      void startPlanSession(suggestedIdx);
    }
  };

  // Retomada de sessão DB ativa: continua de onde parou (meta gravada no
  // início) ou encerra a anterior e começa a nova. Nunca beco sem saída.
  const continueBlocked = async () => {
    const meta = (blockedSession?.meta ?? {}) as SessionMeta;
    setBlockedSession(null);
    const tplDay = (meta as { templateDay?: TemplateInput["days"][number] }).templateDay;
    if (meta.kind === "template" && tplDay) {
      await startTemplateSession({ name: "Provisório", days: [tplDay] }, { force: true });
    } else if (meta.kind === "plan" && typeof meta.dayIdx === "number" && plan && dias.length > 0) {
      await startPlanSession(meta.dayIdx, { force: true });
    } else if (plan && dias.length > 0) {
      await startPlanSession(suggestedIdx, { force: true });
    }
  };

  const discardAndStart = async () => {
    if (user?.id) await completeWorkoutSession(user.id).catch(() => {});
    const pending = pendingStartRef.current;
    pendingStartRef.current = null;
    setBlockedSession(null);
    if (!pending) return;
    if (pending.kind === "template") await startTemplateSession(pending.tpl, { force: true });
    else await startPlanSession(pending.dayIdx, { force: true });
  };

  // Finaliza de qualquer lugar (barra fixa, nudge dos 45min). O conclude()
  // cuida do toast, da fase "done" e da trava anti duplo-toque.
  // Passa o progresso salvo: sem ele, séries parciais (exercício não 100%)
  // eram descartadas e o treino registrava vazio.
  const finishNow = () => {
    navigator.vibrate?.([60, 40, 60]);
    const saved = readSessionProgress()?.progress ?? {};
    void conclude([...completedRef.current], saved);
  };

  // Se o aluno esquecer o app aberto, o treino fecha no teto de 3h.
  useEffect(() => {
    if (phase !== "active" || !daySession) return;
    const remaining = daySession.startedAt + MAX_SESSION_HOURS * 3600_000 - Date.now();
    if (remaining <= 0) {
      finishNow();
      return;
    }
    const t = setTimeout(() => {
      toast("Tempo máximo de 3h atingido", {
        description: "Seu treino foi encerrado automaticamente.",
      });
      finishNow();
    }, remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, daySession?.startedAt]);

  // Nudge aos 45min de sessão: pergunta se está tudo bem e oferece finalizar
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (!daySession || nudgedRef.current || demo) return;
    const fireNudge = () => {
      if (nudgedRef.current) return;
      nudgedRef.current = true;
      // NÃO finaliza com 1 toque: um tap acidental no toast fechava o treino
      // inteiro no meio do descanso. Só leva de volta pra tela de treino.
      toast("45 min de treino. Tudo bem por aí?", {
        description: "Se terminou, volte ao treino e finalize com calma.",
        duration: 12000,
        action: { label: "Ver treino", onClick: () => router.push("/treino") },
      });
    };
    const wait = 45 * 60000 - (Date.now() - daySession.startedAt);
    if (wait <= 0) {
      fireNudge();
      return;
    }
    const t = setTimeout(fireNudge, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daySession]);

  // Ao concluir, atualiza os checks para a rotação sugerir o próximo na hora
  useEffect(() => {
    if (phase === "done") refetchSlotChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Conclusões desta sessão (otimista, local): alimenta contador e reordenação
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const doneCount = doneIds.size;
  // ids concluídos ao vivo (WorkoutInProgress reporta; barra superior usa o ref)
  const completedRef = useRef<string[]>([]);
  const [finishedSessionId, setFinishedSessionId] = useState<string | null>(null);
  // quantos exercícios foram concluídos na sessão que acabou (fonte p/ resumo)
  const [concludedCount, setConcludedCount] = useState<number | null>(null);
  // total do treino que está rodando (pode ser o dia opcional de descanso)
  const [activeTotal, setActiveTotal] = useState(0);
  // ficha completa é opcional: o CTA de iniciar fica antes dela
  const [showFicha, setShowFicha] = useState(false);

  const startWorkout = (list: typeof DEFAULT_DEMO_EX) => {
    activeSessionIdRef.current = null;
    setSession(list);
    setActiveTotal(list.length);
    if (!demo && user?.id && profile?.gym_id) {
      void startWorkoutSession(profile.gym_id, user.id).then((id) => {
        if (id) activeSessionIdRef.current = id;
      });
    }
    setPhase("active");
  };

  /** Sessão construída a partir do TREINO DE HOJE real (não mais lista fixa). */
  const sessionFromDetails = ((data?.details ?? []).map((d) => {
    const ex = d.exercise as ({ photo_url?: string | null; image_url?: string | null; video_url?: string | null } | null) | undefined;
    const exName = d.exercise?.name ?? "Exercício";
    const lib = libraryMatch(exName);
    const curated = lib ? null : findInDatabase(exName);
    const img = ex?.photo_url ?? ex?.image_url ?? lib?.imageUrl ?? curated?.thumbUrl ?? null;
    return {
      id: d.exercise_id ?? d.id,
      name: exName,
      sets: d.sets,
      reps: String(d.reps),
      rest: d.rest_seconds ?? 60,
      tecnica: (d.technique ?? "normal") as "normal" | "biset" | "triset" | "dropset",
      info: d.exercise?.tips?.[0] ?? null,
      tips: d.exercise?.tips ?? null,
      imageUrl: img,
      videoUrl: ex?.video_url ?? lib?.videoUrl ?? curated?.youtubeUrl ?? null,
      thumbUrl: img,
      videoUrlMale: null,
      videoUrlFemale: null,
    };
  }) as typeof DEFAULT_DEMO_EX);

  // SKELETON só no primeiro load. Um refetch em segundo plano (realtime de
  // outro aluno) NUNCA pode derrubar o WorkoutInProgress: matava o descanso,
  // puxava o scroll pro topo e fechava o teclado no meio da série.
  if (loading && !data) {
    return (
      <>
        <TopBar title="Hoje" subtitle={cap(weekdayName())} />
        <div className="space-y-6 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-xl bg-card/40" />
            <div className="h-24 rounded-xl bg-card/40" />
          </div>
          <SkeletonList rows={3} />
        </div>
        <AiCoach />
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Hoje" />
        <div className="p-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  // Sem check-in do dia o conteúdo fica BORRADO + bloqueado (QR, NFC ou senha).
  // TEMPORÁRIO: TRAINING_GATE_OPEN libera tudo para os testes do dono.
  const unlockedToday =
    demo || TRAINING_GATE_OPEN || !!daySession || dayUnlockedLocal || finishedToday || !!data?.activeSessionToday;
  const needsCheckin = !unlockedToday;
  const checkinBanner = needsCheckin ? (
    <div className="mx-auto max-w-md px-4 pt-3">
      <button
        onClick={() => setUnlockOpen(true)}
        className="tactile flex w-full items-center justify-between gap-2 rounded-xl border border-warning/50 bg-warning/[0.08] px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[12px] font-bold text-warning">
          <Lock className="h-4 w-4" />{" "}
          {trainingDay?.status === "rest"
            ? "Hoje é descanso. Faça check-in só se quiser treinar mesmo assim."
            : "Faça check-in na academia para ver o treino de hoje"}
        </span>
        <ScanLine className="h-4 w-4 shrink-0 text-warning" />
      </button>
    </div>
  ) : null;

  // BARRA FIXA DE SESSÃO
  const sessionBar = daySession ? (
    <div className="sticky top-[56px] z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <SessionClock
            startedAt={daySession.startedAt}
            fast={demo}
            onFinish={() => {
              finishNow();
            }}
          />
          {(() => {
            try {
              const saved = readSessionProgress();
              const ids = Object.keys(saved?.progress ?? {});
              if (ids.length === 0) return null;
              const done = ids.filter((id) =>
                (saved!.progress[id].sets ?? []).length > 0 &&
                (saved!.progress[id].sets ?? []).every((s) => s.done)
              ).length;
              return (
                <span className="truncate text-[10px] font-bold tabular-nums text-muted-foreground">
                  {done}/{ids.length} concluídos
                </span>
              );
            } catch {
              return null;
            }
          })()}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {phase !== "active" ? (
            <button
              type="button"
              onClick={resumeSession}
              className="tactile rounded-full bg-brand px-4 py-1.5 text-[11px] font-black text-brand-foreground transition-transform active:scale-95"
            >
              Continuar
            </button>
          ) : null}
          <button
            data-testid="finalizar-treino"
            onClick={() => {
              // um toque acidental aqui fechava o treino e marcava a saída
              const saved = readSessionProgress()?.progress ?? {};
              const doneSets = Object.values(saved).reduce(
                (n, p) => n + (p.sets ?? []).filter((x) => x.done).length,
                0
              );
              const msg = doneSets > 0
                ? `Finalizar o treino agora? ${doneSets} ${doneSets === 1 ? "série feita" : "séries feitas"}.`
                : "Finalizar o treino agora? Nenhuma série foi marcada ainda.";
              if (!window.confirm(msg)) return;
              finishNow();
            }}
            className="tactile rounded-full bg-success px-4 py-1.5 text-[11px] font-black text-black transition-transform active:scale-95"
          >
            Finalizar Treino
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Treino em andamento (demo), substitui a navegação normal.
  if (phase === "active" && (demo || planTodayActive)) {
    const activeExercises = session ?? DEFAULT_DEMO_EX;
    return (
      <AnimatePresence mode="wait">
        <m.div
          key="treino-active"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <WorkoutInProgress exercises={activeExercises} onExerciseDone={(ex, sets) => { void persistExercise(ex, sets); }} onFinish={(ids, prog) => { void conclude(ids, prog); }} onProgressChange={(ids) => { completedRef.current = ids; }} onMinimize={() => { toast.success("Treino rodando! Continue por onde quiser"); router.push("/"); }} />
        </m.div>
      </AnimatePresence>
    );
  }

  // Tela de encerramento, pós-treino. ANTES do "sem treino": quem fez um
  // treino livre/provisório (sem student_workouts) também merece o resumo.
  if (phase === "done") {
    // Sem wrapper com transform: o CTA do resumo é position: fixed e precisa
    // ficar na viewport, não preso ao container animado.
    return (
      <WorkoutSummary
        seconds={summarySeconds ?? 0}
        done={concludedCount ?? Math.min(todayLogs, totalToday)}
        total={activeTotal || totalToday || Math.max(concludedCount ?? 0, 1)}
        sessionId={finishedSessionId}
        sets={summaryStats?.sets}
        volumeKg={summaryStats?.volumeKg}
        onDone={() => {
          router.replace("/");
        }}
      />
    );
  }

  if (!data?.workouts) {
    return (
      <>
        <TopBar title="Hoje" subtitle={cap(weekdayName())} />
        <PendingApprovalBanner />
        <div className="space-y-6 p-4">
          <EmptyState
            title={profile?.approved_at ? "Aguardando seu treino" : "Aguardando aprovação do personal"}
            description={
              profile?.approved_at
                ? "Seu personal está montando seu treino. Enquanto isso, faça seu check-in, suba no ranking e teste um treino livre abaixo."
                : "Seu cadastro está com o personal. Assim que ele aprovar e montar seu treino, ele aparece aqui."
            }
            icon={Dumbbell}
          />
          {profile?.approved_at ? <ProvisionalTemplates onStart={startTemplateSession} /> : null}
        </div>
        <AiCoach />
      </>
    );
  }

  // Já treinou hoje: mostra o feito no topo, mas NÃO trava a tela. Quem
  // treina todo dia (ou duas vezes) segue para o próximo da rotação.
  const allTodayLogs = (data?.logs ?? []).filter((l) => dayOf(l.date) === todayKey).length;
  const doneTodayCard = finishedToday ? (
    <div className="rounded-2xl border border-success/35 bg-gradient-to-b from-success/12 to-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-success">
        <CheckCircle2 className="h-4 w-4" /> Treino de hoje concluído
      </p>
      <p className="mt-1 text-[13px] font-bold text-foreground">
        {allTodayLogs > 0
          ? `${allTodayLogs} ${allTodayLogs === 1 ? "exercício registrado" : "exercícios registrados"} hoje.`
          : "Sessão de hoje encerrada."}
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Quer treinar mais? O próximo da sua divisão está logo abaixo.
      </p>
      <Link
        href="/progresso"
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-success"
      >
        Ver minha evolução <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  ) : null;

  // PLANO DO PERSONAL: o dia de hoje vem do mesmo resolvedor da Home.
  // Dia não programado é descanso; a rotação só vale sem dias fixos.
  const dias = plan?.plan?.dias ?? [];
  const splitType = plan?.plan?.splitType ?? "ABCDEF".slice(0, Math.min(Math.max(dias.length, 2), 6));
  const diaSlot = (d: { slot?: string }, i: number) => d.slot ?? "ABCDEF"[i] ?? String(i + 1);
  const lastBySlot: Record<string, string> = {};
  (slotChecks ?? []).forEach((c) => {
    if (!lastBySlot[c.slot]) lastBySlot[c.slot] = c.checked_at;
  });
  const isRestDay = trainingDay?.status === "rest";
  const sugDay = (trainingDay?.status === "scheduled" ? trainingDay.day : null) as (typeof dias)[number] | null;
  const sugSlot = trainingDay?.slot ?? "";
  const optionalIdx = trainingDay?.optionalDayIdx ?? 0;
  const optionalDay = dias[optionalIdx] ?? null;
  const optionalSlot = trainingDay?.optionalSlot ?? (optionalDay ? diaSlot(optionalDay, optionalIdx) : "");
  const fmtSlotDay = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  // TREINO PROVISÓRIO: modelo de referência para quem ainda não tem plano.
  // Nunca atribui na ficha (sem student_workouts): só executa e registra
  // no histórico como provisório. Nomes exatos da biblioteca, resolução total.
  type TemplateInput = {
    name: string;
    days: Array<{
      nome: string;
      exercicios: Array<{ exercicio: string; series: number; reps: string; descanso: string; rpe?: number | null; dica?: string | null }>;
    }>;
  };
  // Check-in automático: o aluno toca em "Iniciar treino" e pronto. Abre a
  // presença e a sessão no banco (o personal vê "na academia agora") e o
  // início do treino adota essa sessão logo abaixo.
  async function ensureCheckin(): Promise<boolean> {
    if (demo || daySession || dayUnlockedLocal || data?.activeSessionToday) return true;
    if (!TRAINING_GATE_OPEN) {
      setUnlockOpen(true);
      return false;
    }
    if (!isOffline()) {
      const started = await startCheckin("app").catch(() => null);
      if (started) activeSessionIdRef.current = started.session_id;
    }
    markDayUnlocked("app");
    setDayUnlockedLocal(true);
    return true;
  }
  async function startTemplateSession(tpl: TemplateInput, opts?: { force?: boolean }) {
    const day = tpl.days?.[0];
    if (!day || day.exercicios.length === 0) return;
    // Sem check-in aberto: na fase de testes o próprio início faz o check-in.
    if (!(await ensureCheckin())) return;
    // Sessão aberta no check-in é adotada; outra ficha ativa pede retomada.
    let adoptedSession = false;
    if (!demo && !opts?.force && user?.id && !isOffline()) {
      const active = await getActiveWorkoutSession(user.id).catch(() => null);
      if (active) {
        const activeMeta = (active.meta ?? {}) as SessionMeta;
        if (activeMeta.kind === "checkin") {
          const adopted = await updateWorkoutSession(active.id, null, {
            ...activeMeta,
            kind: "template",
            templateDay: day,
            started_by: "checkin",
          } as SessionMeta);
          if (adopted) {
            activeSessionIdRef.current = active.id;
            adoptedSession = true;
            if (!daySession) startDaySession(new Date(active.started_at).getTime());
          }
        }
        if (!adoptedSession) {
          pendingStartRef.current = { kind: "template", tpl };
          setBlockedSession(active);
          return;
        }
      }
    }
    const exList = day.exercicios.map((e, i) => {
      const lib = libraryMatch(e.exercicio);
      const cur = lib ? null : findInDatabase(e.exercicio);
      return {
        id: `tmp-${i}`,
        name: e.exercicio,
        sets: e.series,
        reps: e.reps,
        rest: parseInt(e.descanso) || 60,
        info: e.dica || null,
        tips: null,
        imageUrl: lib?.imageUrl ?? cur?.thumbUrl ?? null,
        videoUrl: lib?.videoUrl ?? cur?.youtubeUrl ?? null,
        thumbUrl: lib?.imageUrl ?? cur?.thumbUrl ?? null,
        videoUrlMale: null,
        videoUrlFemale: null,
      };
    }) as typeof DEFAULT_DEMO_EX;
    // Resolve ids (nomes exatos: ilike acerta tudo; details não existe aqui)
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
    if (!demo && user && profile?.gym_id) {
      void (async () => {
        try {
          const supabase = supabaseBrowser();
          const names = day.exercicios.map((e) => e.exercicio);
          const orFilter = names.map((n) => `name.ilike.%${n.replace(/[%_,]/g, "")}%`).join(",");
          const { data: found } = await supabase
            .from("exercises")
            .select("id, name")
            .or(orFilter)
            .limit(names.length * 2);
          const rows = (found ?? []) as { id: string; name: string }[];
          const map: Record<string, { workoutId: string; exerciseId: string; reps: string; rpe: number | null }> = {};
          day.exercicios.forEach((e, i) => {
            const hit = rows.find((r) => norm(r.name) === norm(e.exercicio))
              ?? rows.find((r) => norm(r.name).includes(norm(e.exercicio).split(" ").slice(0, 2).join(" ")) || norm(e.exercicio).includes(norm(r.name)));
            if (hit) {
              map[`tmp-${i}`] = {
                workoutId: "",
                exerciseId: hit.id,
                reps: e.reps,
                rpe: e.rpe ?? null,
              };
            }
          });
          setPlanExerciseMap(map);
        } catch {
          /* conclude tenta de novo pelo nome */
        }
      })();
    }
    if (!adoptedSession) activeSessionIdRef.current = null;
    setSession(exList);
    setActiveTotal(exList.length);
    setPlanTodayActive(true);
    setActiveSlot(null);
    try {
      localStorage.removeItem("gymfit_session_slot_v1");
    } catch { /* provisório não marca slot */ }
    if (!daySession) startDaySession();
    if (!demo && user?.id && profile?.gym_id && !adoptedSession) {
      void startWorkoutSession(profile.gym_id, user.id, null, { kind: "template", templateDay: day }).then((id) => {
        if (id) activeSessionIdRef.current = id;
      });
    }
    setPhase("active");
  };

  const startPlanSession = async (dayIdx?: number, opts?: { force?: boolean }) => {
    if (!plan?.plan?.dias || plan.plan.dias.length === 0) return;
    const idx = dayIdx ?? suggestedIdx;
    // Sem check-in aberto: na fase de testes o próprio início faz o check-in.
    if (!(await ensureCheckin())) return;
    const day = plan.plan.dias[idx % plan.plan.dias.length];
    const plannedSlot = diaSlot(day, idx % plan.plan.dias.length);

    // Sessão aberta no check-in é adotada; outra ficha ativa pede retomada.
    let adoptedSession = false;
    if (!demo && !opts?.force && user?.id && !isOffline()) {
      const active = await getActiveWorkoutSession(user.id).catch(() => null);
      if (active) {
        const activeMeta = (active.meta ?? {}) as SessionMeta;
        if (activeMeta.kind === "checkin") {
          const adopted = await updateWorkoutSession(active.id, plan.id, {
            ...activeMeta,
            kind: "plan",
            slot: plannedSlot,
            dayIdx: idx,
            programId: plan.programId ?? null,
            workout_name: plan.name ?? null,
          } as SessionMeta);
          if (adopted) {
            activeSessionIdRef.current = active.id;
            adoptedSession = true;
            if (!daySession) startDaySession(new Date(active.started_at).getTime());
          }
        }
        if (!adoptedSession) {
          pendingStartRef.current = { kind: "plan", dayIdx: idx };
          setBlockedSession(active);
          return;
        }
      }
    }
    setActiveSlot(plannedSlot);
    try {
      localStorage.setItem("gymfit_session_slot_v1", JSON.stringify({ slot: diaSlot(day, idx % plan.plan.dias.length), at: Date.now() }));
    } catch { /* ok */ }
    // Carga/reps da última vez de cada exercício: o aluno não digita do zero.
    const planIds = day.exercicios
      .map((e) => (e as { exerciseId?: string | null }).exerciseId)
      .filter((x): x is string => !!x);
    const lastById = demo || isOffline() || !user?.id ? {} : await loadLastPerformance(user.id, planIds);
    // Fotos/vídeos da BIBLIOTECA (mesma fonte do catálogo) por nome; curado como fallback
    const exList = day.exercicios.map((e, i) => {
      const lib = libraryMatch(e.exercicio);
      const cur = lib ? null : findInDatabase(e.exercicio);
      const exId = (e as { exerciseId?: string | null }).exerciseId ?? detailsExerciseId(e.exercicio);
      return {
        id: `plan-${i}`,
        exerciseId: exId,
        last: exId ? lastById[exId] ?? null : null,
        tecnica: (e as { tecnica?: string }).tecnica ?? "normal",
        name: e.exercicio,
        sets: e.series,
        reps: e.reps,
        rest: parseInt(e.descanso) || 60,
        info: e.dica || null,
        tips: null,
        imageUrl: lib?.imageUrl ?? cur?.thumbUrl ?? null,
        videoUrl: lib?.videoUrl ?? cur?.youtubeUrl ?? null,
        thumbUrl: lib?.imageUrl ?? cur?.thumbUrl ?? null,
        videoUrlMale: null,
        videoUrlFemale: null,
      };
    }) as typeof DEFAULT_DEMO_EX;
    // Resolve ids REAIS p/ gravar workout_logs ao concluir:
    // workout_id = student_workouts.id; exercise_id primeiro pelos details do
    // plano ativo (confiável), ilike na biblioteca só para o que faltar.
    // Batch: 1 query com OR em vez de N queries sequenciais.
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
    const map: Record<string, { workoutId: string; exerciseId: string; reps: string; rpe: number | null }> = {};
    const pendingIdx: number[] = [];
    day.exercicios.forEach((e, i) => {
      // o plano já traz o id do exercício; nome só como último recurso
      const fromDetails = (e as { exerciseId?: string | null }).exerciseId ?? detailsExerciseId(e.exercicio);
      if (fromDetails) {
        map[`plan-${i}`] = {
          workoutId: plan.id,
          exerciseId: fromDetails,
          reps: e.reps,
          rpe: e.rpe ?? null,
        };
      } else {
        pendingIdx.push(i);
      }
    });
    setPlanExerciseMap({ ...map });
    if (!demo && user && profile?.gym_id && plan.id && pendingIdx.length > 0) {
      void (async () => {
        try {
          const supabase = supabaseBrowser();
          const names = pendingIdx.map((i) => day.exercicios[i].exercicio);
          const orFilter = names.map((n) => `name.ilike.%${n.replace(/[%_,]/g, "")}%`).join(",");
          const { data: found } = await supabase
            .from("exercises")
            .select("id, name")
            .or(orFilter)
            .limit(names.length * 2);
          const rows = (found ?? []) as { id: string; name: string }[];
          const more: typeof map = {};
          pendingIdx.forEach((i) => {
            const e = day.exercicios[i];
            const hit = rows.find((r) => norm(r.name).includes(norm(e.exercicio).split(" ").slice(0, 2).join(" ")) || norm(e.exercicio).includes(norm(r.name)));
            if (hit) {
              more[`plan-${i}`] = {
                workoutId: plan.id,
                exerciseId: hit.id,
                reps: e.reps,
                rpe: e.rpe ?? null,
              };
            }
          });
          if (Object.keys(more).length > 0) {
            setPlanExerciseMap((prev) => ({ ...prev, ...more }));
          }
        } catch {
          /* sem complemento: conclude usa details + avisa se nada resolver */
        }
      })();
    }
    if (!adoptedSession) activeSessionIdRef.current = null;
    setSession(exList);
    setActiveTotal(exList.length);
    setPlanTodayActive(true);
    if (!daySession) startDaySession();
    if (!demo && user?.id && profile?.gym_id && !adoptedSession) {
      void startWorkoutSession(profile.gym_id, user.id, plan?.id ?? null, {
        kind: "plan",
        slot: diaSlot(day, idx % plan.plan.dias.length),
        dayIdx: idx,
        programId: plan?.programId ?? null,
        workout_name: plan?.name ?? null,
      }).then((id) => {
        if (id) activeSessionIdRef.current = id;
      });
    }
    setPhase("active");
  };

  startPlanRef.current = (idx?: number) => void startPlanSession(idx);

  // Idle normal: pré-treino com sessão ativa.
  return (
    <>
      <TopBar title="Treino" subtitle={cap(weekdayName())} />
      {checkinBanner}
      {sessionBar}
      {pendingFeedback && !feedbackOpen ? (
        <div className="mx-auto max-w-md px-4 pt-3">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="tactile flex w-full items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/[0.07] px-4 py-2.5 text-left"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-wider text-brand">Feedback pendente</span>
              <span className="block text-[11px] text-muted-foreground">Como foi o treino {feedbackDateLabel}?</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[11px] font-black text-brand-foreground">Responder</span>
          </button>
        </div>
      ) : null}
      <div className="space-y-8 p-4">
        {doneTodayCard}


        {/* CONTINUAR: treino em andamento (saiu da tela no meio) */}
        {phase === "idle" && (!!daySession || hasSavedProgress) ? (
          <div className="rounded-2xl border border-success/40 bg-success/[0.07] p-4">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Treino em andamento
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {daySession
                ? "Sua sessão continua rolando. Volte para a tela do treino em tempo real."
                : "Achamos seu progresso salvo. Volte de onde parou."}
            </p>
            <button
              type="button"
              onClick={resumeSession}
              className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 text-[13px] font-black text-black"
            >
              <Play className="h-4 w-4 fill-current" /> Continuar treino
            </button>
          </div>
        ) : null}

        {/* 2. MEU TREINO — rotação por slots (A, B, C...), sem dia fixo.
            Faltou quarta? Faz na quinta: o sugerido é o próximo da rotação,
            e qualquer slot pode ser feito a qualquer dia. */}
        {plan && dias.length > 0 && isRestDay ? (
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Hoje é descanso</p>
            <h2 className="mt-1 font-display text-xl font-black text-foreground">Seu corpo agradece.</h2>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              Hoje não está na sua programação.
              {trainingDay?.scheduledWeekdays.length
                ? ` Seus dias são ${trainingDay.scheduledWeekdays.join(", ")}.`
                : ""}
            </p>
            {trainingDay?.missed ? (
              <p className="mt-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-3 text-[12px] leading-snug text-warning">
                Faltou {trainingDay.missed.weekday} ({trainingDay.missed.slot}). O treino ficou pendente, sem drama.
              </p>
            ) : null}
            {optionalDay ? (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Próximo treino</p>
                <p className="mt-0.5 truncate text-[13px] font-bold text-foreground">
                  {optionalSlot} · {optionalDay.nome}
                </p>
                <button
                  type="button"
                  onClick={() => startPlanSession(optionalIdx)}
                  className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand/10 py-3 text-[13px] font-black text-brand"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {needsCheckin ? "Check-in para treinar mesmo assim" : "Treinar mesmo assim"}
                </button>
              </div>
            ) : null}
          </div>
        ) : plan && dias.length > 0 && sugDay ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Meu treino</h2>
              <div className="flex shrink-0 items-center gap-2">
                <Link href="/equipamento" aria-label="Catálogo de aparelhos e exercícios" className="gf-touch flex h-6 items-center gap-1 rounded-full border border-border px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand">
                  <Dumbbell className="h-3 w-3" /> Catálogo
                </Link>
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                  Divisão {splitType}
                </span>
              </div>
            </div>
            <div className="relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60">
              <div className="space-y-3 p-4">
                <div className={needsCheckin ? "blur-[7px] select-none" : ""} aria-hidden={needsCheckin}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-lg font-black text-brand-foreground">
                      {sugSlot}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-black text-foreground">{sugDay.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sugDay.foco} · {sugDay.exercicios.length} exercícios
                      </p>
                    </div>
                  </div>
                  <m.button
                    onClick={() => startPlanSession(suggestedIdx)}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.97 }}
                    className="gf-touch relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand py-3.5 text-[15px] font-black text-brand-foreground shadow-lg shadow-brand/35"
                  >
                    <m.span
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.15) 55%, transparent 70%)",
                      }}
                      animate={{ x: ["-120%", "220%"] }}
                      transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
                    />
                    {needsCheckin ? (
                      <><Lock className="relative h-5 w-5" /> <span className="relative">Check-in para liberar</span></>
                    ) : (
                      <><Play className="relative h-5 w-5 fill-current" /> <span className="relative">{daySession ? "Continuar treino" : "Iniciar treino"} {sugSlot}</span></>
                    )}
                  </m.button>
                    <button
                      type="button"
                      aria-expanded={showFicha}
                      onClick={() => setShowFicha((v) => !v)}
                      className="tactile flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] py-2.5 text-[11px] font-bold text-muted-foreground"
                    >
                      {showFicha ? "Ocultar ficha" : "Ver ficha completa"}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFicha && "rotate-180")} />
                    </button>
                    {showFicha ? (<>
                    {sugDay.aquecimento?.length ? (
                      <p className="rounded-xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.06] p-2.5 text-[10.5px] leading-snug text-[#4ADE80]">
                        Aquecimento: {sugDay.aquecimento.join(" · ")}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {groupByTecnica(sugDay.exercicios as PlanExercise[]).map((g, gi) => {
                        const hint = tecnicaHint(g.tecnica);
                        const grouped = g.items.length > 1;
                        return (
                          <div
                            key={`g-${gi}`}
                            className={
                              grouped
                                ? "relative overflow-hidden rounded-xl border border-brand/40 bg-brand/[0.06] pl-3"
                                : "rounded-xl border border-white/[0.06] bg-white/[0.02]"
                            }
                          >
                            {grouped ? (
                              <>
                                {/* colchete vertical: amarra os exercícios do bloco */}
                                <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />
                                <div className="flex items-center gap-1.5 px-3 pt-2 text-[9.5px] font-black uppercase tracking-wider text-brand">
                                  <Link2 className="h-3 w-3" /> {tecnicaLabel(g.tecnica)} · {g.items.length} exercícios
                                </div>
                              </>
                            ) : null}
                            <ul className="divide-y divide-white/[0.05]">
                              {g.items.map(({ item: e, index: i }, k) => (
                                <li key={i}>
                                  {k > 0 ? (
                                    <div className="flex items-center gap-1.5 px-3 pt-1.5 text-[9.5px] font-bold uppercase tracking-wide text-brand/80">
                                      <ArrowDown className="h-3 w-3" /> direto, sem descanso
                                    </div>
                                  ) : null}
                                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12.5px] font-semibold text-foreground">
                                        {i + 1}. {e.exercicio}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        RPE {e.rpe}
                                        {!grouped && e.dica ? ` · ${e.dica}` : ""}
                                      </p>
                                    </div>
                                    <p className="shrink-0 text-[11px] font-bold tabular-nums text-brand">
                                      {e.series}x {e.reps} · {e.descanso}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            {hint ? (
                              <p className="px-3 pb-2 text-[10px] leading-snug text-brand/80">{hint}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {sugDay.finalizador ? (
                      <p className="rounded-xl border border-brand/20 bg-brand/[0.06] p-2.5 text-[10.5px] leading-snug text-brand">
                        Finalizador: {sugDay.finalizador}
                      </p>
                    ) : null}
                    </>) : null}
                  </div>
                  {needsCheckin ? (
                    <p className="flex items-center justify-center gap-1.5 rounded-xl border border-warning/40 bg-warning/[0.07] px-3 py-2.5 text-center text-[11px] font-bold text-warning">
                      <Lock className="h-3.5 w-3.5 shrink-0" /> Check-in do dia para ver e iniciar o treino
                    </p>
                  ) : null}
                </div>
              </div>
            {/* demais slots da rotação: qualquer um pode ser feito hoje */}
            {dias.length > 1 ? (
              <div className="mt-2 space-y-1.5">
                {dias.map((d, i) => {
                  if (i === suggestedIdx) return null;
                  const slot = diaSlot(d, i);
                  const doneAt = lastBySlot[slot];
                  return (
                    <div
                      key={`${slot}-${i}`}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] font-display text-sm font-black text-muted-foreground">
                        {slot}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-foreground">{d.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doneAt ? `feito em ${fmtSlotDay(doneAt)}` : "ainda não feito"} · {d.exercicios.length} exercícios
                        </p>
                      </div>
                      {doneAt ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ADE80]" /> : null}
                      <button
                        type="button"
                        onClick={() => startPlanSession(i)}
                        className="tactile min-h-[36px] shrink-0 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[11px] font-black text-brand"
                      >
                        Fazer
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {trainingDay?.missed ? (
              <p className="mt-2 text-center text-[10px] text-warning">
                Faltou {trainingDay.missed.weekday} ({trainingDay.missed.slot}). Hoje é {sugSlot}, sem pular a ficha.
              </p>
            ) : null}
          </div>
        ) : (
          <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Treino de hoje</h2>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/equipamento" aria-label="Catálogo de aparelhos e exercícios" className="gf-touch flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand">
                <Dumbbell className="h-3.5 w-3.5" /> Catálogo
              </Link>
              <Badge variant="secondary">{data.program?.objective ?? "Treino"}</Badge>
            </div>
          </div>

          {data.details.length === 0 ? (
            <EmptyState title="Programa sem exercícios" description="O personal ainda não adicionou séries a este programa." icon={Dumbbell} />
          ) : (
            <div className="space-y-3">
              <div className="relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60">
                <Image
                  src={assetPath("/workout/workout-rack.jpg")}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 448px"
                  className="object-cover object-center"
                />
                <span className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-[#050507]/45 to-[#050507]/92" aria-hidden />
                <span
                  className="absolute inset-0 mix-blend-overlay"
                  style={{ background: "linear-gradient(115deg, rgba(244,113,30,0.25) 0%, rgba(244,113,30,0) 45%)" }}
                  aria-hidden
                />
                <div className="relative p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <CalendarDays className="h-4 w-4 text-[#FF9A5C]" />
                        {tw.label}
                      </p>
                      <p className="text-xs text-white/70">
                        {totalToday} {totalToday === 1 ? "exercício" : "exercícios"} | {totalSets(data.details)} séries
                      </p>
                      <p className="pm-num text-sm text-[#FF9A5C]">
                        {demo ? doneCount : Math.max(todayLogs, doneCount)} de {totalToday} exercícios concluídos hoje
                      </p>
                    </div>
                    {!demo ? <ChevronRight className="h-4 w-4 shrink-0 text-white/50" /> : null}
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <m.div
                      className="h-full w-full origin-left rounded-full bg-[#FF7A2F]"
                      initial={false}
                      animate={{ scaleX: Math.min(1, (demo ? doneCount : Math.max(todayLogs, doneCount)) / Math.max(totalToday, 1)) }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  {demo ? (
                    <button
                      onClick={() => {
                        navigator.vibrate?.([60, 40, 90]);
                        if (!daySession) startDaySession();
                        startWorkout(sessionFromDetails);
                      }}
                      className="gf-touch tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-black text-brand-foreground shadow-lg shadow-brand/35 transition-transform active:scale-[0.98]"
                    >
                      <Play className="h-5 w-5 fill-current" /> {hasSavedProgress ? "Continuar treino" : "Iniciar treino"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
        {/* TREINOS ENVIADOS PELO PERSONAL (depois da ação principal) */}
        <PersonalWorkouts />

        {/* 3. BIBLIOTECA POR MÚSCULO, mapa navy/laranja com escala de recuperação */}
        <BodyMap
          counts={BODY_COUNTS}
          onSelect={(catId) => {
            setLibCat((prev) => (prev === catId ? null : catId));
          }}
          activeCat={libCat ?? ""}
          lastTrained={tw.lastTrained}
        />

        {/* CARDIO: registro rápido de tempo + intensidade (trilha própria) */}
        <CardioQuickAdd />

        {/* 5. HISTÓRICO RECENTE, accordion fechado por padrão */}
        <HistoryList logs={data.logs} />
      </div>
      {/* sheet: exercícios do grupo tocado no mapa */}
      <BottomSheet open={!!libCat} onClose={() => setLibCat(null)}>
        {libCat ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-foreground">{GROUP_LABEL[libCat] ?? libCat}</h3>
                <p className="text-xs text-muted-foreground">Biblioteca de exercícios</p>
              </div>
              <button
                onClick={() => router.push(`/equipamento?grupo=${libCat}`)}
                className="gf-touch flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-brand"
              >
                Catálogo <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {groupExercises(libCat).map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/equipamento?grupo=${libCat}`)}
                  className="gf-touch flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left"
                >
                  {e.imageUrl ? (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setZoomSrc(e.imageUrl ?? null);
                      }}
                      aria-label={`Ampliar ilustração de ${e.name}`}
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.imageUrl ?? ""} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                    </button>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{e.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{e.equipment ?? "Exercício livre"}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </BottomSheet>
      <ImageLightbox src={zoomSrc} alt="Exercício" open={!!zoomSrc} onClose={() => setZoomSrc(null)} />
      <AiCoach />
      {unlockOpen ? (
        <UnlockSheet
          gymId={profile?.gym_id ?? ""}
          onClose={() => setUnlockOpen(false)}
          onUnlocked={() => {
            setUnlockOpen(false);
            void (async () => {
              if (!demo && user?.id) {
                const started = await startCheckin("app");
                if (!started) {
                  toast.error("Check-in não abriu", { description: "Tente de novo na tela de check-in." });
                  return;
                }
                startDaySession(new Date(started.started_at).getTime());
                activeSessionIdRef.current = started.session_id;
              } else {
                startDaySession();
              }
              setDayUnlockedLocal(true);
              markDayUnlocked("senha");
              toast.success("Treino liberado! Seu tempo já começou.");
            })();
          }}
        />
      ) : null}
      {/* Retomada: treino em andamento (continuar ou encerrar e começar outro) */}
      {blockedSession ? (
        <BottomSheet
          open
          onClose={() => {
            setBlockedSession(null);
            pendingStartRef.current = null;
          }}
        >
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-foreground">Treino em andamento</p>
              <p className="text-[11px] text-muted-foreground">
                Começou há{" "}
                {Math.max(
                  1,
                  Math.round((Date.now() - new Date(blockedSession.started_at).getTime()) / 60000)
                )}{" "}
                min. Volte para ele ou encerre e comece outro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void continueBlocked()}
              className="tactile flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25"
            >
              <Play className="h-4 w-4 fill-current" /> Continuar treino
            </button>
            <button
              type="button"
              onClick={() => void discardAndStart()}
              className="tactile w-full rounded-2xl border border-white/[0.08] py-3 text-[12px] font-bold text-muted-foreground"
            >
              Encerrar anterior e começar este
            </button>
          </div>
        </BottomSheet>
      ) : null}
      {/* Feedback do treino anterior (sessão concluída sem feedback) */}
      <WorkoutFeedbackSheet
        open={feedbackOpen && !!pendingFeedback}
        sessionId={pendingFeedback?.id ?? null}
        sessionDateLabel={feedbackDateLabel}
        estimatedMin={feedbackEstimateMin}
        onSaved={() => {
          setFeedbackOpen(false);
          setPendingFeedback(null);
        }}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}

function totalSets(details: Array<WorkoutExercises>): number {
  return details.reduce((acc, d) => acc + d.sets, 0);
}

function HistoryList({ logs }: { logs: WorkoutLogs[] }) {
  const [open, setOpen] = useState(false);
  const sessions = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      const day = localDayKey(l.date);
      if (!day) return;
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 5);
  }, [logs]);

  return (
    <div>
      <button
        onClick={() => {
          navigator.vibrate?.(10);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="tactile flex w-full items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground">Histórico recente</span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {sessions.length > 0 ? `${sessions.length} ${sessions.length === 1 ? "sessão" : "sessões"}` : "nada por aqui ainda"}
          </span>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
        </span>
      </button>

      {open ? (
        sessions.length === 0 ? (
          <div className="animate-fade-in mt-2 rounded-xl border border-dashed border-border bg-card/30 px-4 py-6 text-center">
            <p className="text-[13px] font-semibold text-foreground">Seu histórico aparece aqui</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Termine o primeiro treino e este espaço começa a contar sua história.</p>
          </div>
        ) : (
          <div className="animate-fade-in mt-2 space-y-1.5">
            {sessions.map(([day, count]) => (
              <div key={day} className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3.5 py-2.5">
                <span className="text-sm font-medium text-foreground">{formatDate(day)}</span>
                <span className="text-xs text-muted-foreground">{count} {count === 1 ? "exercício" : "exercícios"}</span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
/** Desbloqueio do treino: QR/NFC na portaria OU senha do dia (trocada todo dia). */
function UnlockSheet({ gymId, onClose, onUnlocked }: {
  gymId: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const confirm = () => {
    if (!gymId) return;
    if (checkDayPassword(gymId, code)) {
      // só destrava o dia; o relógio da sessão só liga quando o treino
      // de fato começar (startPlanSession/startTemplateSession)
      markDayUnlocked("senha");
      navigator.vibrate?.(60);
      onUnlocked();
    } else {
      setErr(true);
      navigator.vibrate?.([40, 40]);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Liberar treino de hoje">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-border bg-background p-5 pb-8">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-brand">
          <Lock className="h-3.5 w-3.5" /> Treino bloqueado
        </p>
        <h3 className="mt-0.5 text-lg font-black text-foreground">Libere o treino de hoje</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Escaneie o QR da portaria ou peça a senha do dia na recepção.
        </p>
        <Link
          href="/checkin?scan=1&from=/treino"
          className="tactile mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-brand/10 py-3 text-[13px] font-black text-brand"
        >
          <ScanLine className="h-4 w-4" /> Escanear QR / NFC
        </Link>
        <div className="my-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-white/10" /> ou senha do dia <span className="h-px flex-1 bg-white/10" />
        </div>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3 w-3" /> Senha de hoje (4 dígitos)
          </span>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(false); }}
            inputMode="numeric"
            aria-label="Senha do dia"
            placeholder="••••"
            className="h-12 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] px-3.5 text-center text-lg font-black tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          />
        </label>
        {err ? <p className="mt-1.5 text-center text-[11px] font-bold text-[#F87171]">Senha incorreta. Confira na recepção.</p> : null}
        <button
          onClick={confirm}
          disabled={code.length !== 4}
          className="tactile mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-brand text-[13px] font-black text-brand-foreground shadow-lg shadow-brand/25 disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={3} /> Liberar treino
        </button>
      </div>
    </div>
  );
}
