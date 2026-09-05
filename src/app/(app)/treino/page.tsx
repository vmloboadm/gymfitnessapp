"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Dumbbell,
  CalendarDays,
  ChevronRight,
  ThumbsUp,
  Meh,
  Frown,
  Play,
  CheckCircle2,
  Lock,
  ScanLine,
  ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { startWorkoutSession, completeWorkoutSession } from "~/lib/supabase/workout-session";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import WorkoutInProgress from "~/components/common/WorkoutInProgress";
import BodyMap from "~/components/body-map";
import { ImageLightbox } from "~/components/common/ImageLightbox";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { PersonalWorkouts } from "~/components/student/PersonalWorkouts";
import { fetchMyAssignedPlans } from "~/lib/gym-api";
import { AiCoach } from "~/components/ai/AiCoachLazy";
import { cn } from "~/lib/utils";
import { assetPath } from "~/lib/asset-path";
import { findInDatabase } from "~/lib/exercises-database";
import { libraryMatch } from "~/lib/demo-data";
import { toast } from "sonner";
import WorkoutSummary from "~/components/common/WorkoutSummary";
import { weekdayName } from "~/lib/utils/calculations";
import { useWorkoutSession, elapsedSeconds, readSessionProgress } from "~/lib/workout-session";
import { SessionClock } from "~/components/common/SessionClock";
import { nextWorkoutFromLogs } from "~/components/dashboard/mocks";

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

type TreinoDay = WorkoutExercises & { exercise: Exercises | null };

type TreinoData = {
  workouts: StudentWorkouts | null;
  program: WorkoutPrograms | null;
  details: TreinoDay[];
  logs: WorkoutLogs[];
  days: WorkoutDays[];
};

type FetchResult<T> = { data: T | null; error: { message: string } | null };

function errorResult<T>(message: string): FetchResult<T> {
  return { data: null, error: { message } };
}

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
  const { user, profile } = useAuth();
  const demo = isDemoMode();
  const [feeling, setFeeling] = useState<string | null>(null);
  const [summarySeconds, setSummarySeconds] = useState<number | null>(null);
  const [_rpe, _setRpe] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [session, setSession] = useState<typeof DEFAULT_DEMO_EX | null>(null);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [libCat, setLibCat] = useState<string | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

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
      const programRes = await supabase.from("workout_programs").select("*").eq("id", programId).maybeSingle();
      const daysRes = await supabase.from("workout_days").select("*").eq("program_id", programId).order("day_order", { ascending: true });
      const logsRes = await supabase.from("workout_logs").select("date, weight_kg, reps").eq("student_id", user.id).gte("date", new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10));

      if (daysRes.error || logsRes.error) return errorResult(daysRes.error?.message ?? logsRes.error?.message ?? "Erro");

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
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );
  const router = useRouter();
  const { session: daySession, start: startDaySession, end: endDaySession } = useWorkoutSession();

  // PLANO DO PERSONAL (produção): treino de hoje vem do student_workouts ativo
  const [planActive, setPlanActive] = useState<Awaited<ReturnType<typeof fetchMyAssignedPlans>>> ([]);
  const [planExerciseMap, setPlanExerciseMap] = useState<Record<string, { workoutId: string; exerciseId: string; reps: string; rpe: number | null }>>({});
  const [planTodayActive, setPlanTodayActive] = useState(false);
  useEffect(() => {
    if (demo || !user || !profile?.gym_id) return;
    fetchMyAssignedPlans(user.id, profile.gym_id)
      .then((rows) => setPlanActive(rows))
      .catch(() => setPlanActive([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, user?.id, profile?.gym_id]);

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

  const todayKey = new Date().toISOString().slice(0, 10);
  // MESMA FONTE da home, nunca diverge
  const tw = useMemo(() => (demo ? getTodayWorkout() : resolveFromLogs(data?.logs ?? [])), [demo, data?.logs]);
  function resolveFromLogs(logs: NonNullable<TreinoData["logs"]>) {
    const f = nextWorkoutFromLogs(logs);
    const lastTrained: Record<string, string | null> = {};
    for (const l of logs as Array<NonNullable<TreinoData["logs"]>[number] & { exercise_id?: string }>) {
      const cat = DEMO_EX_GROUP_REAL[l.exercise_id ?? ""] ?? null;
      if (!cat) continue;
      if (!lastTrained[cat] || l.date > (lastTrained[cat] ?? "")) lastTrained[cat] = l.date;
    }
    return { focusLabel: String(f.label), resume: !!f.resume, bodyCat: String(f.bodyCat), label: `Treino do dia · ${String(f.label)}`, lastTrained };
  }
  const todayLogs = useMemo(() => (data?.logs ?? []).filter((l) => l.date.slice(0, 10) === todayKey).length, [data, todayKey]);
  const totalToday = data?.details.length ?? 0;
  const finishedToday = totalToday > 0 && todayLogs >= totalToday;



  const conclude = async (completedIds?: string[]) => {
    setSummarySeconds(daySession ? elapsedSeconds(daySession.startedAt, Date.now()) : 0);
    endDaySession();
    if (!demo && user?.id) {
      void completeWorkoutSession(user.id);
    }
    if (completedIds?.length) {
      setDoneIds((prev) => new Set([...prev, ...completedIds]));
      // produção: grava workout_logs reais dos exercícios concluídos
      // (workout_id = student_workouts.id; só exercícios resolvidos na biblioteca)
      if (!demo && planExerciseMap && Object.keys(planExerciseMap).length > 0 && user && profile) {
        const supabase = supabaseBrowser();
        const rows = completedIds
          .map((id) => ({ id, m: planExerciseMap[id] }))
          .filter(({ m }) => m && m.exerciseId && m.workoutId)
          .map(({ m }) => ({
            gym_id: profile.gym_id,
            student_id: user.id,
            workout_id: m.workoutId,
            exercise_id: m.exerciseId,
            date: new Date().toISOString(),
            reps: m.reps,
            rpe: m.rpe ?? null,
          }));
        if (rows.length) {
          const { error: logErr } = await supabase.from("workout_logs").insert(rows as never);
          if (logErr) {
            toast.error("Falha ao registrar treino", { description: "Tente novamente." });
          }
        }
      }
    }
    navigator.vibrate?.([60, 40, 90]);
    setPhase("done");
    toast.success("Treino registrado!");
  };

  // Conclusões desta sessão (otimista, local): alimenta contador e reordenação
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const doneCount = doneIds.size;

  const startWorkout = (list: typeof DEFAULT_DEMO_EX) => {
    setSession(list);
    if (!demo && user?.id && profile?.gym_id) {
      void startWorkoutSession(profile.gym_id, user.id);
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
      info: d.exercise?.tips?.[0] ?? null,
      tips: d.exercise?.tips ?? null,
      imageUrl: img,
      videoUrl: ex?.video_url ?? lib?.videoUrl ?? curated?.youtubeUrl ?? null,
      thumbUrl: img,
      videoUrlMale: null,
      videoUrlFemale: null,
    };
  }) as typeof DEFAULT_DEMO_EX);

  if (loading) {
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

  // Sem check-in NÃO bloqueia mais a tela: mostra aviso discreto e libera tudo
  const needsCheckin = !daySession;
  const _checkinBanner = needsCheckin ? (
    <div className="mx-auto max-w-md px-4 pt-3">
      <Link href="/checkin?scan=1&from=/treino" className="flex items-center justify-between gap-2 rounded-xl border border-warning/50 bg-warning/[0.08] px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12px] font-bold text-warning">
          <Lock className="h-4 w-4" /> Faça o check-in na portaria pra registrar presença
        </span>
        <ScanLine className="h-4 w-4 shrink-0 text-warning" />
      </Link>
    </div>
  ) : null;

  // BARRA FIXA DE SESSÃO
  const sessionBar = daySession ? (
    <div className="sticky top-[56px] z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <SessionClock
            startedAt={daySession.startedAt}
            fast={demo}
            onFinish={() => {
              setSummarySeconds(elapsedSeconds(daySession.startedAt, Date.now()));
              endDaySession();
              setPhase("done");
            }}
          />
        </div>
        <button
          onClick={() => {
            navigator.vibrate?.([60, 40, 60]);
            setSummarySeconds(elapsedSeconds(daySession.startedAt, Date.now()));
            endDaySession();
            toast.success("Sessão finalizada. Registre como foi!");
            setPhase("done");
          }}
          className="tactile rounded-full bg-success px-4 py-1.5 text-[11px] font-black text-black transition-transform active:scale-95"
        >
          Finalizar Treino
        </button>
      </div>
    </div>
  ) : null;

  // Treino em andamento (demo), substitui a navegação normal.
  if (phase === "active" && (demo || planTodayActive)) {
    const activeExercises = session ?? DEFAULT_DEMO_EX;
    return <WorkoutInProgress exercises={activeExercises} onFinish={(ids) => { conclude(ids); setPlanTodayActive(false); }} onMinimize={() => { toast.success("Treino rodando! Continue por onde quiser"); router.push("/"); }} />;
  }

  if (!data?.workouts) {
    return (
      <>
        <TopBar title="Hoje" subtitle={cap(weekdayName())} />
        <div className="space-y-6 p-4">
          <EmptyState title="Sem treino prescrito para hoje" description="Quando seu personal atribuir um programa, ele aparece aqui, e os planos disponíveis já dão um gostinho do que vem por aí." icon={Dumbbell} />
        </div>
        <AiCoach />
      </>
    );
  }

  // Tela de encerramento, pós-treino
  if (phase === "done") {
    return (
      <WorkoutSummary
        seconds={summarySeconds ?? 0}
        done={Math.min(todayLogs || 1, totalToday || 1)}
        total={totalToday || 1}
        onDone={() => {
          router.replace("/");
        }}
      />
    );
  }

  // Idle: se já concluiu hoje (dado real), mostra resumo em vez de "Iniciar".
  if (finishedToday) {
    return (
      <>
        <TopBar title="Treino" subtitle={cap(weekdayName())} />
        <div className="space-y-6 p-4">
          <div className="rounded-2xl border border-success/35 bg-gradient-to-b from-success/12 to-card p-5">
            <p className="gf-section flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4" /> Concluído hoje
            </p>
            <h2 className="mt-2 font-display text-lg font-bold text-foreground">
              {todayLogs} de {totalToday} exercícios
            </h2>
            <p className="mt-1 gf-card-text">Tudo feito! A recuperação também faz parte do plano.</p>
            <Link
              href="/progresso"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25"
            >
              Ver resumo do treino <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <AiCoach />
      </>
    );
  }

  // PLANO DO PERSONAL: dia de hoje correspondente ao dia da semana
  const WEEK_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const plan = planActive[0] ?? null;
  const daysSel = plan?.plan?.daysSelected ?? [];
  const dow = new Date().getDay();
  const todayLabel = WEEK_PT[dow];
  const orderedDays = daysSel.length
    ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].filter((d) => daysSel.includes(d))
    : [];
  const todayIdx = orderedDays.length ? orderedDays.indexOf(todayLabel) : -1;
  // Dia de hoje do plano: se o dia da semana está na pauta, SEMPRE mostra um
  // treino (cicla pelos dias cadastrados). Só é descanso quando o dia não
  // está na pauta — antes, planos com menos dias que a pauta caiam em
  // "Hoje é descanso" na sexta (todayIdx >= dias.length).
  const planToday =
    plan?.plan?.dias && plan.plan.dias.length > 0
      ? todayIdx >= 0
        ? { day: plan.plan.dias[todayIdx % plan.plan.dias.length], isRest: false }
        : { day: null, isRest: true }
      : null;
  const startPlanSession = () => {
    if (!plan?.plan?.dias || plan.plan.dias.length === 0 || todayIdx < 0) return;
    const day = plan.plan.dias[todayIdx % plan.plan.dias.length];
    // Fotos/vídeos da BIBLIOTECA (mesma fonte do catálogo) por nome; curado como fallback
    const exList = day.exercicios.map((e, i) => {
      const lib = libraryMatch(e.exercicio);
      const cur = lib ? null : findInDatabase(e.exercicio);
      return {
        id: `plan-${i}`,
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
    // workout_id = student_workouts.id; exercise_id casando nome na biblioteca.
    if (!demo && user && profile?.gym_id && plan.id) {
      void (async () => {
        const supabase = supabaseBrowser();
        const map: Record<string, { workoutId: string; exerciseId: string; reps: string; rpe: number | null }> = {};
        for (let i = 0; i < day.exercicios.length; i++) {
          const e = day.exercicios[i];
          try {
            const { data: ex } = await supabase
              .from("exercises")
              .select("id")
              .ilike("name", `%${e.exercicio}%`)
              .limit(1)
              .maybeSingle();
            const exerciseId = (ex as { id: string } | null)?.id;
            if (exerciseId) {
              map[`plan-${i}`] = {
                workoutId: plan.id,
                exerciseId,
                reps: e.reps,
                rpe: e.rpe ?? null,
              };
            }
          } catch { /* sem log para este exercício */ }
        }
        setPlanExerciseMap(map);
      })();
    }
    setSession(exList);
    setPlanTodayActive(true);
    startDaySession();
    if (!demo && user?.id && profile?.gym_id) {
      void startWorkoutSession(profile.gym_id, user.id, plan?.id ?? null);
    }
    setPhase("active");
  };

  // Idle normal: pré-treino com sessão ativa.
  return (
    <>
      <TopBar title="Treino" subtitle={cap(weekdayName())} />
      {sessionBar}
      <div className="space-y-8 p-4">
        {/* 1. STATUS ATUAL, linha compacta sem card pesado */}
        <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 backdrop-blur">
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">Como está?</span>
          <div className="flex flex-1 justify-end gap-1.5">
            {[
              { key: "leve", label: "Leve", icon: Frown, tone: "text-sky-400" },
              { key: "ok", label: "No ritmo", icon: Meh, tone: "text-warning" },
              { key: "pronto", label: "Na energia", icon: ThumbsUp, tone: "text-success" },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = feeling === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    setFeeling(opt.key);
                    toast.success(`Feedback registrado: ${opt.label}`);
                  }}
                  className={cn(
                    "tactile flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors",
                    active ? "border-brand bg-brand-soft text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", opt.tone)} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {feeling ? (
            <p className="-mt-3 pl-3 text-[10px] text-brand">Anotado! O Assistente de Treino ajusta amanhã.</p>
          ) : null}
        </div>

        {/* 1.5 TREINOS ENVIADOS PELO PERSONAL */}
        <PersonalWorkouts />

        {/* 2. TREINO DE HOJE — do plano do Personal quando existe */}
        {plan && planToday && (planToday.isRest || planToday.day) ? (
          planToday.isRest || !planToday.day ? (
            <div className="gf-card gf-glass !p-5 text-center">
              <p className="text-sm font-bold text-foreground">Hoje é descanso</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Seu plano pauta {daysSel.join(", ")} · o próximo treino é {orderedDays[(todayIdx + 1) % orderedDays.length] ?? "—"}.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Treino de hoje</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href="/equipamento" aria-label="Catálogo de aparelhos e exercícios" className="gf-touch flex h-6 items-center gap-1 rounded-full border border-border px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand">
                    <Dumbbell className="h-3 w-3" /> Catálogo
                  </Link>
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                    {todayLabel} · {plan.name}
                  </span>
                </div>
              </div>
              <div className="relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60">
                <div className="space-y-3 p-4">
                  <div>
                    <p className="font-display text-lg font-black text-foreground">{planToday.day.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {planToday.day.foco} · {planToday.day.exercicios.length} exercícios
                    </p>
                  </div>
                  {planToday.day.aquecimento?.length ? (
                    <p className="rounded-xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.06] p-2.5 text-[10.5px] leading-snug text-[#4ADE80]">
                      Aquecimento: {planToday.day.aquecimento.join(" · ")}
                    </p>
                  ) : null}
                  <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    {planToday.day.exercicios.map((e, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-foreground">
                            {i + 1}. {e.exercicio}
                          </p>
                          <p className="text-[10px] text-muted-foreground">RPE {e.rpe}{e.dica ? ` · ${e.dica}` : ""}</p>
                        </div>
                        <p className="shrink-0 text-[11px] font-bold tabular-nums text-brand">
                          {e.series}x {e.reps} · {e.descanso}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {planToday.day.finalizador ? (
                    <p className="rounded-xl border border-brand/20 bg-brand/[0.06] p-2.5 text-[10.5px] leading-snug text-brand">
                      Finalizador: {planToday.day.finalizador}
                    </p>
                  ) : null}
                  <button
                    onClick={startPlanSession}
                    className="gf-touch tactile flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-black text-brand-foreground shadow-lg shadow-brand/35 transition-transform active:scale-[0.98]"
                  >
                    <Play className="h-5 w-5 fill-current" /> Iniciar treino de hoje
                  </button>
                </div>
              </div>
            </div>
          )
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
                    <motion.div
                      className="h-full rounded-full bg-[#FF7A2F]"
                      initial={false}
                      animate={{ width: `${Math.min(100, ((demo ? doneCount : Math.max(todayLogs, doneCount)) / Math.max(totalToday, 1)) * 100)}%` }}
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
        {/* 3. BIBLIOTECA POR MÚSCULO, mapa navy/laranja com escala de recuperação */}
        <BodyMap
          counts={BODY_COUNTS}
          onSelect={(catId) => {
            setLibCat((prev) => (prev === catId ? null : catId));
          }}
          activeCat={libCat ?? ""}
          lastTrained={tw.lastTrained}
        />

        {/* 4. PLANOS DISPONÍVEIS, preview bloqueado, liberação pelo personal */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Planos disponíveis</h2>
            <span className="text-[10px] font-semibold text-muted-foreground">liberação pelo personal</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                name: "Full Body Iniciante", focus: "Corpo inteiro", weeks: "4 semanas", level: "Iniciante",
                ghost: ["Supino Reto", "Puxada Alta", "Leg Press 45°", "Prancha"],
              },
              {
                name: "Push · Pull · Legs", focus: "Divisão 3 dias", weeks: "8 semanas", level: "Intermediário",
                ghost: ["Supino Inclinado", "Remada Curvada", "Agachamento Livre", "Elevação Lateral"],
              },
              {
                name: "Força Máxima", focus: "Baixas reps · cargas altas", weeks: "6 semanas", level: "Avançado",
                ghost: ["Agachamento Livre", "Supino Reto", "Levantamento Terra", "Desenvolvimento"],
              },
              {
                name: "Hipertrofia Express", focus: "Volume alto · 40min", weeks: "5 semanas", level: "Intermediário",
                ghost: ["Rosca Direta", "Tríceps Corda", "Crucifixo Máquina", "Cadeira Extensora"],
              },
            ].map((p) => (
              <div key={p.name} className="relative overflow-hidden rounded-[16px] border border-border bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10">
                    <Lock className="h-3.5 w-3.5 text-brand" />
                  </span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{p.level}</span>
                </div>
                <p className="mt-2 truncate text-[13px] font-bold text-foreground">{p.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.focus} · {p.weeks}</p>

                {/* lista fantasma, dá vontade de desbloquear */}
                <ul className="mt-2.5 space-y-1 select-none" aria-hidden>
                  {p.ghost.map((g) => (
                    <li key={g} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 blur-[1.5px]">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      {g}
                    </li>
                  ))}
                </ul>

                <p className="mt-2.5 flex items-center gap-1 rounded-lg bg-brand/10 py-1.5 text-center justify-center text-[10px] font-semibold text-brand">
                  <Lock className="h-2.5 w-2.5" /> Solicite ao seu Personal
                </p>
              </div>
            ))}
          </div>
        </div>

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
      const day = l.date.slice(0, 10);
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