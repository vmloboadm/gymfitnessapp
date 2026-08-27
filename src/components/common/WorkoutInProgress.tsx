"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, Info, MoreHorizontal, PlayCircle, X } from "lucide-react";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import { cn } from "~/lib/utils";

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

/**
 * Treino em andamento — estilo Strong/Hevy.
 *
 * Tela limpa: exercício atual em destaque, séries como chips grandes,
 * reps editáveis, botão Finalizar sempre acessível.
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
}: {
  exercises: WExercise[];
  onFinish: (completedIds: string[]) => void;
}) {
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const [showFinish, setShowFinish] = useState(false);

  useEffect(() => {
    setProgress((prev) => {
      const next: Record<string, ExerciseProgress> = {};
      for (const ex of exercises) {
        const existing = prev[ex.id];
        next[ex.id] = existing ?? {
          sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), done: false })),
        };
      }
      return next;
    });
  }, [exercises]);

  const completedIds = useMemo(() => {
    return exercises
      .filter((e) => progress[e.id]?.sets.every((s) => s.done))
      .map((e) => e.id);
  }, [progress, exercises]);

  const totalDoneSets = useMemo(
    () => exercises.reduce((acc, e) => acc + (progress[e.id]?.sets.filter((s) => s.done).length ?? 0), 0),
    [progress, exercises]
  );
  const totalSets = useMemo(() => exercises.reduce((acc, e) => acc + e.sets, 0), [exercises]);

  const current = exercises[currentIdx];
  const currentProgress = current ? progress[current.id] : null;
  const nextEx = exercises[currentIdx + 1];

  const toggleSet = (idx: number) => {
    if (!current) return;
    navigator.vibrate?.(15);
    setProgress((prev) => {
      const p = prev[current.id];
      if (!p) return prev;
      const sets = p.sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
      return { ...prev, [current.id]: { sets } };
    });
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
  };

  const goNext = () => {
    if (currentIdx < exercises.length - 1) setCurrentIdx((i) => i + 1);
  };
  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const handleFinish = () => {
    navigator.vibrate?.([50, 30, 50]);
    onFinish(completedIds);
  };

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
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={goPrev} disabled={currentIdx === 0} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-muted-foreground">{currentIdx + 1} de {exercises.length}</p>
          <div className="mx-auto mt-1 h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((currentIdx + 1) / exercises.length) * 100}%` }} />
          </div>
        </div>
        <button onClick={() => setShowFinish(true)} className="rounded-full bg-success px-3 py-1.5 text-[11px] font-black text-black">
          Finalizar
        </button>
      </header>

      {/* Exercício atual */}
      <main className="flex-1 px-4 pt-6 pb-28">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-md"
            >
              {/* Título do exercício */}
              <div className="mb-6 flex items-start gap-4">
                <FitnessIcon glyph={fitnessForName(current.name)} size={52} />
                <div className="min-w-0 flex-1">
                  <h1 className="text-[22px] font-black leading-tight text-foreground">{current.name}</h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">{current.sets} séries · {current.reps} reps</p>
                </div>
              </div>

              {/* Ações rápidas */}
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setDetailEx({ name: current.name, info: current.info ?? null, tips: current.tips ?? null, imageUrl: current.imageUrl ?? null, videoUrl: current.videoUrl ?? null })}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                >
                  <Info className="h-3.5 w-3.5" /> Ficha
                </button>
                {(current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale) && (
                  <button
                    onClick={() => {
                      const url = current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale;
                      if (url) setVideoEx({ name: current.name, poster: current.thumbUrl ?? current.imageUrl ?? null, url });
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Vídeo
                  </button>
                )}
              </div>

              {/* Séries */}
              <div className="space-y-2.5">
                {currentProgress?.sets.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                      s.done ? "border-success/40 bg-success/[0.08]" : "border-border bg-card/50"
                    )}
                  >
                    <button
                      onClick={() => toggleSet(i)}
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        s.done ? "border-success bg-success text-black" : "border-border text-muted-foreground"
                      )}
                    >
                      <Check className={cn("h-5 w-5", s.done && "stroke-[3]")} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-bold", s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                        Série {i + 1}
                      </p>
                      <p className="text-xs text-muted-foreground">Toque para marcar feita</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={s.reps}
                        onChange={(e) => setReps(i, e.target.value)}
                        className="h-10 w-14 rounded-xl border border-border bg-background text-center text-base font-bold text-foreground outline-none focus:border-brand"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">reps</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Marcar todas */}
              <button
                onClick={markAll}
                className="mt-4 w-full rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-card"
              >
                {currentProgress?.sets.every((s) => s.done) ? "Desmarcar todas" : "Marcar todas como feitas"}
              </button>

              {/* Descanso sugerido */}
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Descanso sugerido: <span className="font-bold text-foreground">{current.rest}s</span></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Próximo exercício */}
        {nextEx && (
          <div className="mx-auto mt-8 max-w-md">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximo</p>
            <button
              onClick={goNext}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/40 p-3 text-left"
            >
              <FitnessIcon glyph={fitnessForName(nextEx.name)} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{nextEx.name}</p>
                <p className="text-xs text-muted-foreground">{nextEx.sets} séries · {nextEx.reps} reps</p>
              </div>
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {completedIds.length} de {exercises.length} exercícios
            </p>
            <p className="text-[10px] text-muted-foreground/70">{totalDoneSets} de {totalSets} séries feitas</p>
          </div>
          <button
            onClick={() => setShowFinish(true)}
            className="rounded-xl bg-success px-5 py-2.5 text-sm font-black text-black shadow-lg shadow-success/20"
          >
            Finalizar treino
          </button>
        </div>
      </footer>

      {/* Confirmação */}
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
                <button onClick={() => setShowFinish(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Você fez <span className="font-bold text-foreground">{totalDoneSets}</span> séries em{" "}
                <span className="font-bold text-foreground">{completedIds.length}</span> exercícios.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowFinish(false)}
                  className="rounded-xl border border-border py-3 text-sm font-bold text-foreground"
                >
                  Continuar
                </button>
                <button
                  onClick={handleFinish}
                  className="rounded-xl bg-success py-3 text-sm font-black text-black shadow-lg shadow-success/25"
                >
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
    </div>
  );
}
