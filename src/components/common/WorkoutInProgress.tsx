"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, PlayCircle, Timer, X } from "lucide-react";
import Image from "next/image";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { readSessionProgress, saveSessionProgress, clearSessionProgress } from "~/lib/workout-session";
import { ImageLightbox } from "~/components/common/ImageLightbox";

export type WExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  info?: string | null;
  tips?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  videoUrlMale?: string | null;
  videoUrlFemale?: string | null;
};

type SetRecord = { reps: string; done: boolean };
type ExerciseProgress = { sets: SetRecord[] };

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Sessão de treino ativa · padrão Strong/Hevy.
 *
 * Header fixo enxuto, foto real do exercício, linhas de série compactas
 * com reps editáveis, descanso automático e CTA único de progressão.
 * A BottomNav global fica oculta (body.session-active) durante a sessão.
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
  onMinimize,
}: {
  exercises: WExercise[];
  onFinish: (completedIds: string[]) => void;
  onMinimize?: () => void;
}) {
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const restInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // imersão: topo da página + esconde BottomNav global
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add("session-active");
    return () => {
      document.body.classList.remove("session-active");
      if (restInterval.current) clearInterval(restInterval.current);
    };
  }, []);

  useEffect(() => {
    const saved = readSessionProgress();
    const savedIds = saved ? (saved.exercises as Array<{ id?: string }>).map((e) => e?.id ?? "").join("|") : "";
    const currentIds = exercises.map((e) => e.id).join("|");
    if (saved && savedIds && savedIds === currentIds) {
      // retoma exatamente de onde parou (aluno circulou pelo app)
      setProgress(saved.progress as Record<string, ExerciseProgress>);
      setCurrentIdx(Math.min(saved.currentIdx, exercises.length - 1));
      return;
    }
    setProgress(() => {
      const next: Record<string, ExerciseProgress> = {};
      for (const ex of exercises) {
        next[ex.id] = {
          sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), done: false })),
        };
      }
      return next;
    });
  }, [exercises]);

  // persiste a cada mudança · navegar pelo app não perde séries
  useEffect(() => {
    if (!exercises.length || !Object.keys(progress).length) return;
    saveSessionProgress({ exercises, progress, currentIdx });
  }, [exercises, progress, currentIdx]);

  const startRest = useCallback((seconds: number) => {
    if (!seconds || seconds <= 0) return;
    if (restInterval.current) clearInterval(restInterval.current);
    setRestLeft(seconds);
    restInterval.current = setInterval(() => {
      setRestLeft((v) => {
        if (v === null || v <= 1) {
          if (restInterval.current) clearInterval(restInterval.current);
          return null;
        }
        return v - 1;
      });
    }, 1000);
  }, []);

  const completedIds = useMemo(
    () => exercises.filter((e) => progress[e.id]?.sets.every((s) => s.done)).map((e) => e.id),
    [progress, exercises]
  );
  const doneSets = useMemo(
    () => exercises.reduce((acc, e) => acc + (progress[e.id]?.sets.filter((s) => s.done).length ?? 0), 0),
    [progress, exercises]
  );
  const totalSets = useMemo(() => exercises.reduce((acc, e) => acc + e.sets, 0), [exercises]);

  const current = exercises[currentIdx];
  const currentProgress = current ? progress[current.id] : null;
  const currentAllDone = !!currentProgress?.sets.length && currentProgress.sets.every((s) => s.done);
  const nextEx = exercises[currentIdx + 1];
  const isLast = currentIdx === exercises.length - 1;

  const toggleSet = (idx: number) => {
    if (!current) return;
    const willBeDone = !currentProgress?.sets[idx]?.done;
    navigator.vibrate?.(willBeDone ? 15 : 8);
    setProgress((prev) => {
      const p = prev[current.id];
      if (!p) return prev;
      const sets = p.sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
      return { ...prev, [current.id]: { sets } };
    });
    if (willBeDone) startRest(current.rest);
  };

  const setReps = (idx: number, reps: string) => {
    if (!current) return;
    setProgress((prev) => {
      const p = prev[current.id];
      if (!p) return prev;
      const sets = p.sets.map((s, i) => (i === idx ? { ...s, reps } : s));
      return { ...prev, [current.id]: { sets } };
    });
  };

  const markAll = () => {
    if (!current) return;
    navigator.vibrate?.(25);
    setProgress((prev) => {
      const p = prev[current.id];
      if (!p) return prev;
      const allDone = p.sets.every((s) => s.done);
      return { ...prev, [current.id]: { sets: p.sets.map((s) => ({ ...s, done: !allDone })) } };
    });
    if (!currentAllDone) startRest(current.rest);
  };

  const goNext = () => {
    if (!isLast) {
      navigator.vibrate?.(20);
      setCurrentIdx((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const advanceOrFinish = () => {
    if (isLast) {
      setShowFinish(true);
      return;
    }
    if (!currentAllDone && currentProgress?.sets.some((s) => s.done)) {
      toast("Exercício pulado · o que marcou continua valendo");
    } else if (!currentAllDone) {
      toast("Exercício pulado");
    }
    goNext();
  };

  const handleFinish = () => {
    navigator.vibrate?.([50, 30, 50]);
    if (restInterval.current) clearInterval(restInterval.current);
    clearSessionProgress();
    onFinish(completedIds);
  };

  const photo = current?.thumbUrl ?? current?.imageUrl ?? null;

  if (!exercises || exercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm font-bold text-foreground">Nenhum exercício nesta sessão</p>
        <button onClick={() => onFinish([])} className="rounded-xl border border-border px-6 py-3 text-sm font-bold">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Header fixo */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2.5">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            aria-label="Exercício anterior"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Exercício {currentIdx + 1} de {exercises.length}
            </p>
            <div className="mx-auto mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / exercises.length) * 100}%` }}
              />
            </div>
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              aria-label="Minimizar treino (continua em segundo plano)"
              title="Minimizar · o treino continua rodando"
              className="gf-touch flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setShowFinish(true)}
            className="shrink-0 rounded-full bg-success px-3.5 py-1.5 text-[11px] font-black text-black"
          >
            Finalizar
          </button>
        </div>
      </header>

      {/* Timer de descanso */}
      <AnimatePresence>
        {restLeft !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-[57px] z-20 border-b border-brand/20 bg-brand/[0.08] backdrop-blur"
          >
            <div className="mx-auto flex max-w-md items-center justify-center gap-3 px-4 py-2">
              <Timer className="h-4 w-4 text-brand" />
              <span className="text-sm font-black tabular-nums text-brand">{fmt(restLeft)}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">descanso</span>
              <button
                onClick={() => {
                  if (restInterval.current) clearInterval(restInterval.current);
                  setRestLeft(null);
                }}
                className="ml-2 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground"
              >
                Pular
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conteúdo */}
      <main className="flex-1 px-4 pb-40 pt-4">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-md"
            >
              {/* Hero do exercício */}
              <div className="mb-5 flex items-center gap-4">
                {photo ? (
                  <button
                    onClick={() => setZoomOpen(true)}
                    aria-label="Ampliar ilustração do exercício"
                    className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo ?? ""} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                ) : (
                  <FitnessIcon glyph={fitnessForName(current.name)} size={72} className="rounded-2xl" />
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-black leading-tight text-foreground">{current.name}</h1>
                  <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
                    {current.sets} séries × {current.reps} reps
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() =>
                        setDetailEx({
                          name: current.name,
                          info: current.info ?? null,
                          tips: current.tips ?? null,
                          imageUrl: current.imageUrl ?? null,
                          videoUrl: current.videoUrl ?? null,
                        })
                      }
                      className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                    >
                      <Info className="h-3 w-3" /> Ficha
                    </button>
                    {(current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale) && (
                      <button
                        onClick={() => {
                          const url = current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale;
                          if (url) setVideoEx({ name: current.name, poster: current.thumbUrl ?? current.imageUrl ?? null, url });
                        }}
                        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                      >
                        <PlayCircle className="h-3 w-3" /> Vídeo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Séries · linha inteira tapável, sem tabela técnica */}
              <div className="space-y-2">
                {currentProgress?.sets.map((s, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSet(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSet(i);
                      }
                    }}
                    aria-pressed={s.done}
                    aria-label={`Série ${i + 1}: toque para ${s.done ? "desmarcar" : "marcar como feita"}`}
                    className={cn(
                      "flex h-16 cursor-pointer select-none items-center gap-3.5 rounded-2xl border px-4 transition-all active:scale-[0.99]",
                      s.done ? "border-success/45 bg-success/[0.09]" : "border-border bg-card/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black",
                        s.done ? "bg-success text-black" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.done ? <Check className="h-5 w-5 stroke-[3]" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[15px] font-black", s.done ? "text-success" : "text-foreground")}>
                        Série {i + 1}
                      </span>
                      <span className="block text-[11px] font-semibold text-muted-foreground">
                        {s.done ? "Feita! Descansa e parte pra próxima" : `${current.reps} repetições`}
                      </span>
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={s.reps}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setReps(i, e.target.value)}
                      aria-label={`Reps da série ${i + 1}`}
                      className="h-11 w-14 shrink-0 rounded-xl border border-border bg-background text-center text-lg font-black tabular-nums text-foreground outline-none focus:border-brand"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={markAll}
                className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-card"
              >
                {currentAllDone ? "Desmarcar todas" : "Marcar todas como feitas"}
              </button>

              {/* Próximo exercício */}
              {nextEx && (
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">A seguir</p>
                  <button
                    onClick={goNext}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/40 p-3 text-left"
                  >
                    <FitnessIcon glyph={fitnessForName(nextEx.name)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{nextEx.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {nextEx.sets} séries × {nextEx.reps} reps
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA fixo */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="w-[72px] shrink-0">
            <p className="text-sm font-black tabular-nums text-foreground">{doneSets}/{totalSets}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">séries</p>
          </div>
          <button
            onClick={advanceOrFinish}
            className="flex-1 rounded-xl bg-brand py-3.5 text-sm font-black text-brand-foreground shadow-lg shadow-brand/25 transition-transform active:scale-[0.98]"
          >
            {isLast ? "Finalizar treino" : currentAllDone ? "Próximo exercício →" : "Pular exercício →"}
          </button>
        </div>
      </footer>

      {/* Confirmação de finalização */}
      <AnimatePresence>
        {showFinish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center"
            onClick={() => setShowFinish(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-black text-foreground">Finalizar treino?</h3>
                <button
                  onClick={() => setShowFinish(false)}
                  aria-label="Fechar"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Você fez <span className="font-bold text-foreground">{doneSets}</span> séries em{" "}
                <span className="font-bold text-foreground">{completedIds.length}</span> de {exercises.length} exercícios.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => setShowFinish(false)} className="rounded-xl border border-border py-3 text-sm font-bold text-foreground">
                  Continuar
                </button>
                <button onClick={handleFinish} className="rounded-xl bg-success py-3 text-sm font-black text-black shadow-lg shadow-success/25">
                  Finalizar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExerciseVideoModal
        open={!!videoEx}
        onClose={() => setVideoEx(null)}
        name={videoEx?.name ?? ""}
        poster={videoEx?.poster ?? null}
        videoUrl={videoEx?.url ?? null}
      />
      <BottomSheet open={!!detailEx} onClose={() => setDetailEx(null)}>
        {detailEx ? (
          <div className="space-y-3">
            <h3 className="text-base font-black text-foreground">{detailEx.name}</h3>
            <p className="text-sm text-muted-foreground">{detailEx.info ?? "Execução padrão, cadência controlada."}</p>
            {detailEx.videoUrl ? (
              <a
                href={detailEx.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-brand"
              >
                Ver vídeo no YouTube
              </a>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
      <ImageLightbox src={photo} alt={current?.name} open={zoomOpen} onClose={() => setZoomOpen(false)} />
    </div>
  );
}
