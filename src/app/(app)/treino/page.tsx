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
  Sparkles,
  Nfc,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  Lock,
  X,
  ScanLine,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import BodyMap from "~/components/body-map";
import WorkoutInProgress from "~/components/common/WorkoutInProgress";
import AiCoach, { openAiCoach } from "~/components/ai/coach-chat";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { ExerciseInfoSheet, iconForExercise, type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import WorkoutSummary from "~/components/common/WorkoutSummary";
import { weekdayName } from "~/lib/utils/calculations";
import { todayWorkoutTitle } from "~/lib/academia";
import { useWorkoutSession, elapsedSeconds, formatMMSS } from "~/lib/workout-session";
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
import type { DemoExercise } from "~/lib/demo-data";
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

const CAT_LABEL: Record<string, string> = {
  strength: "Força",
  cardio: "Cardio",
  peito: "Peito",
  costas: "Costas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  perna: "Perna",
  gluteo: "Glúteo",
  core: "Core",
  panturrilha: "Panturrilha",
};

/* Região do mapa corporal → categorias da biblioteca de exercícios */
const BODY_CATS: Record<string, string[]> = {
  peito: ["peito"],
  costas: ["costas"],
  perna: ["inferiores"],
  ombro: ["ombro"],
  braco: ["biceps", "triceps", "antebraco"],
  abdomen: ["abdomen"],
};

const BODY_COUNTS = (() => {
  const cat = (ids: string[]) =>
    demoLib.filter((c) => ids.includes(c.id)).reduce((acc, c) => acc + c.subs.reduce((s, sub) => s + sub.exercises.length, 0), 0);
  return {
    peito: cat(BODY_CATS.peito),
    costas: cat(BODY_CATS.costas),
    perna: cat(BODY_CATS.perna),
    ombro: cat(BODY_CATS.ombro),
    braco: cat(BODY_CATS.braco),
    abdomen: cat(BODY_CATS.abdomen),
  };
})();

const IMG: string | null = "/workout/workout-strength.jpg";
const YT = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " execução")}`;
const DEFAULT_DEMO_EX: Array<{ id: string; name: string; picto: string; sets: number; reps: string; rest: number; info: string; tips?: string[] | null; imageUrl: string | null; videoUrl: string | null }> = [
  { id: "d1", name: "Supino Reto", picto: "🏋️", sets: 4, reps: "10", rest: 90, imageUrl: IMG as string | null, videoUrl: YT("Supino Reto"), info: "Empurre sem travar o cotovelo." },
  { id: "d2", name: "Crucifixo com Halteres", picto: "🦾", sets: 3, reps: "12", rest: 60, imageUrl: IMG as string | null, videoUrl: YT("Crucifixo Halteres"), info: "Abra até a linha do peito e volte controlando." },
  { id: "d3", name: "Desenvolvimento Militar", picto: "🏋️", sets: 3, reps: "10", rest: 75, imageUrl: IMG as string | null, videoUrl: YT("Desenvolvimento Militar"), info: "Core firme, sem arco lombar." },
  { id: "d4", name: "Elevação Lateral", picto: "🪶", sets: 4, reps: "15", rest: 45, imageUrl: IMG as string | null, videoUrl: YT("Elevação Lateral"), info: "Cotovelos levemente flexionados." },
];

export default function TreinoHomePage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();
  const [feeling, setFeeling] = useState<string | null>(null);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [summarySeconds, setSummarySeconds] = useState<number | null>(null);
  /* Sessão POR APARELHO (fluxo NFC contextual): exercícioId → início.
     No demo, tocar na instrução simula a leitura da tag. */
  const [eqSessions, setEqSessions] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (Object.keys(eqSessions).length === 0) return;
    const i = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, [Object.keys(eqSessions).length]);
  const [rpe, setRpe] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [bodyCat, setBodyCat] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const foco = new URLSearchParams(window.location.search).get("foco");
    return foco && foco in BODY_CATS ? foco : null;
  });
  const [session, setSession] = useState<typeof DEFAULT_DEMO_EX | null>(null);

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
        const weRes = await supabase.from("workout_exercises").select("*").in("day_id", dayIds).order("order", { ascending: true });
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
  const { session: daySession, end: endDaySession } = useWorkoutSession();
  const [nowTick2, setNowTick2] = useState(Date.now());
  useEffect(() => {
    if (!daySession) return;
    const i = setInterval(() => setNowTick2(Date.now()), 1000);
    return () => clearInterval(i);
  }, [daySession]);

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
  const focus = { label: tw.focusLabel, resume: tw.resume, bodyCat: tw.bodyCat };
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

  const machineByExercise = useMemo(() => {
    const map = new Map<string, string>();
    if (!demo) return map;
    demoLib.forEach((c) => c.subs.forEach((s) => s.exercises.forEach((e) => e.machineId && map.set(e.name, e.machineId))));
    return map;
  }, [demo]);

  const conclude = () => {
    setSummarySeconds(daySession ? elapsedSeconds(daySession.startedAt, Date.now()) : 0);
    endDaySession();
    navigator.vibrate?.([60, 40, 90]);
    setPhase("done");
    toast.success("Treino concluído! 💪");
  };

  const startWorkout = (list: typeof DEFAULT_DEMO_EX) => {
    setSession(list);
    setPhase("active");
  };

  const bodyExercises = useMemo(() => {
    if (!demo || !bodyCat) return [];
    const ids = BODY_CATS[bodyCat] ?? [];
    return demoLib.filter((c) => ids.includes(c.id)).flatMap((c) => c.subs.flatMap((s) => s.exercises));
  }, [demo, bodyCat]);

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

  // GATE: sem sessão validada por scan, o treino não abre
  if (!daySession) {
    return (
      <>
        <TopBar title="Treino" subtitle="Bloqueado" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-4 p-4 pt-10 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-brand/30 bg-brand/10">
            <Lock className="h-9 w-9 text-brand" />
          </span>
          <h2 className="text-lg font-black text-foreground">Faça o check-in para liberar</h2>
          <p className="gf-card-text mx-auto max-w-[300px]">
            Escaneie o QR da portaria ou encoste o celular no leitor NFC. Validou, treino liberado.
          </p>
          <Link
            href="/checkin?scan=1&from=/treino"
            className="gf-touch tactile mx-auto flex w-full max-w-[320px] items-center justify-center gap-2 rounded-2xl bg-[#F4711E] py-4 text-[15px] font-black text-black shadow-[0_0_30px_rgba(244,113,30,0.5)] transition-transform active:scale-[0.98]"
          >
            <ScanLine className="h-5 w-5" /> Escanear e liberar treino
          </Link>
          <Link href="/" className="block text-xs font-semibold text-muted-underline hover:underline text-muted-foreground">
            voltar ao início
          </Link>
        </motion.div>
      </>
    );
  }

  // BARRA FIXA DE SESSÃO
  const sessionBar = (
    <div className="sticky top-[56px] z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="pm-num text-[18px] leading-none text-foreground">
            {formatMMSS(elapsedSeconds(daySession.startedAt, nowTick2))}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">treinando</span>
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
  );

  // Treino em andamento (demo), substitui a navegação normal.
  if (phase === "active" && demo) {
    const demoExercises = session ?? DEFAULT_DEMO_EX;
    return <WorkoutInProgress exercises={demoExercises} onFinish={conclude} />;
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

  // Tela de encerramento, pós-treino (RPE não fica preso no topo)
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

  // legado RPE desativado
  if (false) {
    return (
      <>
        <TopBar title="Treino" subtitle="Encerrado" />
        <div className="space-y-6 p-4">
          <div className="rounded-[20px] border border-success/35 bg-gradient-to-b from-success/15 to-card p-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/20">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </span>
            <h2 className="mt-3 font-display text-xl font-bold text-foreground">Treino concluído!</h2>
            <p className="mt-1 gf-card-text">Bora anotar como foi, esse dado treina o seu plano.</p>
          </div>

          <div className="gf-card gf-glass !py-4">
            <p className="gf-section mb-2">Como foi o treino?</p>
            <p className="gf-card-text mb-3">Toque em como o treino pesou, sem número, sem grilo.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "tranquilo", label: "Tranquilo", icon: Meh, tone: "text-sky-400" },
                { key: "na medida", label: "Na medida", icon: ThumbsUp, tone: "text-success" },
                { key: "difícil", label: "Difícil", icon: Frown, tone: "text-warning" },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = rpe === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setRpe(opt.key);
                      toast.success(`RPE registrado: ${opt.label}`);
                    }}
                    className={cn(
                      "gf-touch tactile flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors",
                      active ? "border-brand bg-brand-soft text-foreground" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", opt.tone)} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {rpe ? (
              <p className="mt-2 text-[11px] text-brand">RPE {rpe} salvo, entra no cálculo de progresso do seu plano.</p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                RPE é a nota de 0 a 10 de como o treino pesou pra você. Ajuda o Personal Digital a calibrar a carga de amanhã.
              </p>
            )}
          </div>

          <Link
            href="/progresso"
            className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25"
          >
            Ver resumo do treino <ChevronRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => {
              setRpe(null);
              setPhase("idle");
            }}
            className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Treinar novamente
          </button>
        </div>
        <AiCoach />
      </>
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

  // Idle normal: pré-treino com sessão ativa.
  return (
    <>
      <TopBar title="Treino" subtitle={cap(weekdayName())} />
      {sessionBar}
      <div className="space-y-8 p-4">
        {/* 1. STATUS ATUAL, como você chegou hoje */}
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Como você está hoje?</p>
          <div className="grid grid-cols-3 gap-2">
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
                    "tactile flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                    active ? "border-brand bg-brand-soft text-foreground" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", opt.tone)} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {feeling ? (
            <p className="mt-2 text-[11px] text-brand">Anotado! O Personal Digital ajusta a intensidade do treino para amanhã.</p>
          ) : null}
        </div>

        {/* 2. MAPA CORPORAL, toque na região para ver os aparelhos */}
        <BodyMap
          counts={BODY_COUNTS}
          onSelect={(catId) => setBodyCat((prev) => (prev === catId ? null : catId))}
          activeCat={bodyCat ?? ""}
          lastTrained={tw.lastTrained}
        />

        {/* Grupo selecionado: lista de exercícios/aparelhos p/ começar */}
        {bodyCat && demo ? (
          <div className="gf-card gf-glass !p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="gf-label text-brand">
                Guia rápido · {BODY_CATS[bodyCat]?.map((c) => CAT_LABEL[c] ?? c).join(" / ") ?? "Selecionado"}
              </p>
              <button
                onClick={() => {
                  navigator.vibrate?.(10);
                  setBodyCat(null);
                }}
                className="gf-touch tactile flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                aria-label="Fechar categoria e voltar ao treino"
              >
                <X className="h-3 w-3" /> Fechar
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {bodyExercises.slice(0, 8).map((e: DemoExercise) => (
                <button
                  key={e.id}
                  onClick={() =>
                    startWorkout(
                      bodyExercises.slice(0, 6).map((x) => ({
                        id: x.id,
                        name: x.name,
                        picto: x.picto,
                        sets: 3,
                        reps: "10",
                        rest: 75,
                        info: x.info,
                        tips: x.tags ?? null,
                        imageUrl: x.imageUrl ?? null,
                        videoUrl: x.videoUrl ?? null,
                      }))
                    )
                  }
                  className="gf-touch flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left transition-colors hover:border-brand/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-brand">
                    {(() => { const I = iconForExercise(e.name); return <I className="h-5 w-5" />; })()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{e.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{e.equipment ?? "Exercício livre"}</span>
                  </span>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDetailEx({ name: e.name, info: e.info, tips: e.tags ?? null, imageUrl: e.imageUrl ?? null, videoUrl: e.videoUrl ?? null });
                    }}
                    aria-label={`Ver ficha de ${e.name}`}
                    className="gf-touch tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  {e.machineId ? (
                    <Badge variant="outline" className="shrink-0 !px-2 !text-[9px]">
                      <Nfc className="mr-1 h-3 w-3 text-brand" /> NFC
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                startWorkout(
                  bodyExercises.slice(0, 6).map((x) => ({
                    id: x.id,
                    name: x.name,
                    picto: x.picto,
                    sets: 3,
                    reps: "10",
                    rest: 75,
                    info: x.info,
                    tips: x.tags ?? null,
                    imageUrl: x.imageUrl ?? null,
                    videoUrl: x.videoUrl ?? null,
                  }))
                )
              }
              className="gf-touch mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25"
            >
              <Play className="h-4 w-4" /> Começar treino ({Math.min(bodyExercises.length, 6)} exercícios)
            </button>
          </div>
        ) : null}

        {/* 3. TREINO DE HOJE, programa ativo + exercícios */}
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
                  src="/workout/workout-rack.jpg"
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
                        {todayLogs} de {totalToday} exercícios concluídos hoje
                      </p>
                    </div>
                    {demo ? (
                      <button
                        onClick={() => startWorkout(DEFAULT_DEMO_EX)}
                        className="gf-touch flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/30"
                      >
                        <Play className="h-4 w-4" /> Iniciar
                      </button>
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
                    )}
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className="h-full rounded-full bg-[#FF7A2F]"
                      initial={false}
                      animate={{ width: `${Math.min(100, (todayLogs / Math.max(totalToday, 1)) * 100)}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {data.details.map((d) => (
                  <ExerciseRow
                    key={d.id}
                    item={d}
                    machineFor={machineByExercise.get(d.exercise?.name ?? "") ?? ""}
                    sessionStart={eqSessions[d.exercise_id ?? d.id] ?? null}
                    now={nowTick}
                    onStart={() => {
                      const id = d.exercise_id ?? d.id;
                      navigator.vibrate?.(40);
                      setEqSessions((prev) => ({ ...prev, [id]: Date.now() }));
                      toast.success("Sessão iniciada, cronômetro rodando");
                    }}
                    onFinish={() => {
                      const id = d.exercise_id ?? d.id;
                      navigator.vibrate?.(60);
                      setEqSessions((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                      toast.success("Exercício finalizado. Bom trabalho! 💪");
                    }}
                    onInfo={() =>
                      setDetailEx({
                        name: d.exercise?.name ?? "Exercício",
                        info: d.exercise?.tips?.[0] ?? null,
                        tips: d.exercise?.tips ?? null,
                        imageUrl: (d.exercise as any)?.imageUrl ?? d.exercise?.photo_url ?? null,
                        videoUrl: (d.exercise as any)?.videoUrl ?? (d.exercise as any)?.video_url ?? null,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>

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
        <ExerciseInfoSheet ex={detailEx} onClose={() => setDetailEx(null)} />
      </div>
      <AiCoach />
    </>
  );
}

function ExerciseRow({
  item,
  machineFor,
  sessionStart,
  now,
  onStart,
  onFinish,
  onInfo,
}: {
  item: TreinoDay;
  machineFor: string;
  sessionStart?: number | null;
  now?: number;
  onStart?: () => void;
  onFinish?: () => void;
  onInfo: () => void;
}) {
  const elapsed = sessionStart && now ? Math.max(0, Math.floor((now - sessionStart) / 1000)) : 0;
  const demoModeHint = isDemoMode();
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const suggestion =
    item.exercise?.name === "Supino Reto"
      ? "Aparelho ocupado? Crucifixo com halteres no banco livre, mesmo estímulo, sem espera."
      : item.exercise?.name === "Agachamento"
        ? "Smith ocupado? Leg press 45° é um bom substituto de hoje."
        : null;
  const catLabel = item.exercise?.category ? CAT_LABEL[item.exercise.category] ?? item.exercise.category : "-";
  const ex = item.exercise as (Exercises & { imageUrl?: string; videoUrl?: string }) | null;
  const photo = ex?.photo_url ?? ex?.imageUrl ?? null;
  const video = ex?.video_url ?? ex?.videoUrl ?? null;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-start gap-3">
        {photo ? (
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.06]">
            <Image src={photo} alt="" fill sizes="56px" className="object-cover" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{item.exercise?.name ?? "Exercício"}</p>
          <p className="text-xs text-muted-foreground">
            {item.sets} × {item.reps} · descanso {item.rest_seconds}s
            {item.technique && item.technique !== "standard" ? ` · ${item.technique}` : ""}
          </p>
          <div className="flex items-center gap-1.5 pt-1">
            {video ? (
              <a
                href={video}
                target="_blank"
                rel="noopener noreferrer"
                className="tactile inline-flex items-center gap-1 rounded-full bg-brand/12 px-2.5 py-1 text-[10px] font-bold text-brand transition-colors hover:bg-brand/20"
              >
                <Play className="h-3 w-3 fill-current" /> Ver vídeo
              </a>
            ) : null}
            <Badge variant="outline">{catLabel}</Badge>
          </div>
        </div>
        <button
          onClick={onInfo}
          aria-label={`Ficha técnica de ${item.exercise?.name}`}
          title="Como fazer"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => openAiCoach(`Sobre o exercício ${item.exercise?.name ?? "desse"}: como executar com segurança e ajustar a carga?`)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          aria-label={`Perguntar ao Personal Digital sobre ${item.exercise?.name}`}
          title="Perguntar ao Personal Digital"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sugestão GymFitness, destaque secundário discreto */}
      {suggestion ? (
        <p className="mt-2.5 border-l-2 border-brand/50 bg-brand/[0.06] py-1.5 pl-2.5 pr-2 text-[11px] leading-snug text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 align-[-2px] text-brand" />
          {suggestion}
        </p>
      ) : null}

      {/* Fluxo NFC contextual por exercício */}
      {sessionStart ? (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-success/40 bg-success/10 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="pm-num text-[20px] leading-none text-foreground">{mm}:{ss}</span>
            <span className="text-[11px] font-semibold text-success">em andamento</span>
          </div>
          <button
            onClick={onFinish}
            className="gf-touch tactile rounded-full bg-success px-4 py-1.5 text-[11px] font-bold text-black transition-transform active:scale-95"
          >
            Finalizar
          </button>
        </div>
      ) : machineFor ? (
        <button
          onClick={onStart}
          className="tactile mt-2.5 flex w-full items-center justify-between rounded-xl border border-brand/30 bg-brand/[0.07] px-3 py-2.5 text-left transition-colors hover:border-brand/50"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
            <Nfc className="h-3.5 w-3.5" /> Encoste o celular no aparelho para começar a contar
          </span>
          {demoModeHint ? (
            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">simular</span>
          ) : null}
        </button>
      ) : null}

      {item.exercise?.tips?.length ? <p className="mt-2 text-xs text-muted-foreground">{item.exercise.tips[0]}</p> : null}
    </div>
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
            <p className="mt-1 text-[12px] text-muted-foreground">Termine o primeiro treino e este espaço começa a contar sua história. 💪</p>
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