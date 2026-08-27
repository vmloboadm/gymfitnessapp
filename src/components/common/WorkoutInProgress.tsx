"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  PlayCircle,
  Timer,
  X,
} from "lucide-react";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import Image from "next/image";
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
type ExerciseProgress = { sets: SetRecord[]; skipped: boolean };

/**
 * Treino em andamento — registro de séries.
 *
 * O aluno vê cada exercício e marca as séries que executou. O descanso é
 * opcional: um timer leve que pode ser iniciado, pulado ou ignorado. O botão
 * "Finalizar treino" está sempre acessível, mesmo que nenhum exercício tenha
 * sido completado.
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
}: {
  exercises: WExercise[];
  onFinish: (completedIds: string[]) => void;
}) {
  const [progress, setProgress] = useState<Record<string, ExerciseProgress>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const [restState, setRestState] = useState<{ exerciseId: string; left: number } | null>(null);
  const [finishConfirm, setFinishConfirm] = useState(false);

  // Inicializa progresso e abre o primeiro exercício não concluído
  useEffect(() => {
    setProgress((prev) => {
      const next: Record<string, ExerciseProgress> = {};
      for (const ex of exercises) {
        const existing = prev[ex.id];
        next[ex.id] = existing ?? {
          sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), done: false })),
          skipped: false,
        };
      }
      return next;
    });
    if (!activeId && exercises.length > 0) {
      setActiveId(exercises[0].id);
    }
  }, [exercises, activeId]);

  // Timer de descanso
  useEffect(() => {
    if (!restState || restState.left <= 0) return;
    const t = setInterval(() => {
      setRestState((s) => {
        if (!s) return null;
        if (s.left <= 1) return null;
        return { ...s, left: s.left - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restState?.exerciseId, restState ? 1 : 0]);

  const summary = useMemo(() => {
    const totalSets = exercises.reduce((acc, e) => acc + e.sets, 0);
    const doneSets = exercises.reduce(
      (acc, e) => acc + (progress[e.id]?.sets.filter((s) => s.done).length ?? 0),
      0
    );
    const completedExercises = exercises.filter((e) => isExerciseDone(progress[e.id])).map((e) => e.id);
    return { totalSets, doneSets, completedExercises, pct: totalSets ? doneSets / totalSets : 0 };
  }, [progress, exercises]);

  const toggleSet = (exId: string, idx: number) => {
    navigator.vibrate?.(20);
    setProgress((prev) => {
      const p = prev[exId];
      if (!p) return prev;
      const sets = p.sets.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
      return { ...prev, [exId]: { ...p, sets } };
    });
  };

  const setReps = (exId: string, idx: number, reps: string) => {
    setProgress((prev) => {
      const p = prev[exId];
      if (!p) return prev;
      const sets = p.sets.map((s, i) => (i === idx ? { ...s, reps } : s));
      return { ...prev, [exId]: { ...p, sets } };
    });
  };

  const markAllSets = (exId: string, done: boolean) => {
    navigator.vibrate?.(35);
    setProgress((prev) => {
      const p = prev[exId];
      if (!p) return prev;
      const sets = p.sets.map((s) => ({ ...s, done }));
      return { ...prev, [exId]: { ...p, sets } };
    });
  };

  const startRest = (exId: string, seconds: number) => {
    navigator.vibrate?.(15);
    setRestState({ exerciseId: exId, left: seconds });
  };

  const skipRest = () => setRestState(null);

  const handleFinish = () => {
    navigator.vibrate?.([60, 40, 60]);
    onFinish(summary.completedExercises);
  };

  if (!exercises || exercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Nenhum exercício nesta sessão</p>
        <button
          onClick={() => { navigator.vibrate?.(40); onFinish([]); }}
          className="gf-touch rounded-xl border border-border px-6 py-3 text-sm font-bold text-foreground"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* HEADER — progresso + finalizar sempre visível */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">Treino em andamento</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  animate={{ width: `${summary.pct * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                {summary.doneSets}/{summary.totalSets}
              </span>
            </div>
          </div>
          <button
            onClick={() => setFinishConfirm(true)}
            className="gf-touch shrink-0 rounded-xl bg-success px-4 py-2 text-[12px] font-black text-black shadow-lg shadow-success/20"
          >
            Finalizar
          </button>
        </div>
      </header>

      {/* LISTA DE EXERCÍCIOS */}
      <main className="mx-auto w-full max-w-md flex-1 space-y-3 p-4 pb-32">
        {exercises.map((e, i) => (
          <ExerciseCard
            key={e.id}
            index={i + 1}
            exercise={e}
            progress={progress[e.id]}
            isOpen={activeId === e.id}
            onToggle={() => setActiveId((id) => (id === e.id ? null : e.id))}
            onToggleSet={(idx) => toggleSet(e.id, idx)}
            onRepsChange={(idx, reps) => setReps(e.id, idx, reps)}
            onMarkAll={(done) => markAllSets(e.id, done)}
            onStartRest={(seconds) => startRest(e.id, seconds)}
            onDetail={() =>
              setDetailEx({ name: e.name, info: e.info ?? null, tips: e.tips ?? null, imageUrl: e.imageUrl ?? null, videoUrl: e.videoUrl ?? null })
            }
            onVideo={() => {
              const url = e.videoUrlMale ?? e.videoUrl ?? e.videoUrlFemale;
              if (url) setVideoEx({ name: e.name, poster: e.thumbUrl ?? e.imageUrl ?? null, url });
            }}
            restLeft={restState?.exerciseId === e.id ? restState.left : 0}
            onSkipRest={skipRest}
          />
        ))}
      </main>

      {/* FOOTER FLUTUANTE — acesso rápido ao atual + finalizar */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {summary.completedExercises.length} de {exercises.length} exercícios
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {summary.doneSets} séries registradas
            </p>
          </div>
          <button
            onClick={() => setFinishConfirm(true)}
            className="gf-touch shrink-0 rounded-xl bg-success px-5 py-3 text-[13px] font-black text-black shadow-lg shadow-success/25 transition-transform active:scale-[0.98]"
          >
            Finalizar treino
          </button>
        </div>
      </footer>

      {/* CONFIRMAÇÃO DE FINALIZAÇÃO */}
      <AnimatePresence>
        {finishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center"
            onClick={() => setFinishConfirm(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-black text-foreground">Finalizar treino?</h3>
                <button
                  onClick={() => setFinishConfirm(false)}
                  className="gf-touch flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-label="Continuar treinando"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Você registrou <span className="font-bold text-foreground">{summary.doneSets}</span> séries em{" "}
                <span className="font-bold text-foreground">{summary.completedExercises.length}</span> exercícios.
              </p>

              <div className="mt-4 space-y-1.5">
                {exercises.map((e) => {
                  const done = progress[e.id]?.sets.filter((s) => s.done).length ?? 0;
                  if (done === 0) return null;
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">{e.name}</span>
                      <span className="font-bold text-success">{done}/{e.sets} séries</span>
                    </div>
                  );
                })}
                {summary.doneSets === 0 && (
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    Nenhuma série registrada ainda. Você pode finalizar mesmo assim.
                  </p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFinishConfirm(false)}
                  className="gf-touch rounded-xl border border-border py-3 text-sm font-bold text-foreground"
                >
                  Continuar
                </button>
                <button
                  onClick={handleFinish}
                  className="gf-touch rounded-xl bg-success py-3 text-sm font-black text-black shadow-lg shadow-success/25"
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
            <p className="gf-card-text">{detailEx.info ?? "Execução padrão, cadência controlada."}</p>
            {detailEx.videoUrl ? (
              <a
                href={detailEx.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-brand"
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

function ExerciseCard({
  index,
  exercise,
  progress,
  isOpen,
  onToggle,
  onToggleSet,
  onRepsChange,
  onMarkAll,
  onStartRest,
  onDetail,
  onVideo,
  restLeft,
  onSkipRest,
}: {
  index: number;
  exercise: WExercise;
  progress?: ExerciseProgress;
  isOpen: boolean;
  onToggle: () => void;
  onToggleSet: (idx: number) => void;
  onRepsChange: (idx: number, reps: string) => void;
  onMarkAll: (done: boolean) => void;
  onStartRest: (seconds: number) => void;
  onDetail: () => void;
  onVideo: () => void;
  restLeft: number;
  onSkipRest: () => void;
}) {
  const sets = progress?.sets ?? [];
  const doneCount = sets.filter((s) => s.done).length;
  const allDone = isExerciseDone(progress);
  const noneDone = doneCount === 0;
  const glyph = fitnessForName(exercise.name);

  return (
    <motion.div
      layout
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        allDone
          ? "border-success/40 bg-success/[0.06]"
          : isOpen
            ? "border-brand/50 bg-card/60"
            : "border-border bg-card/40"
      )}
    >
      {/* CABEÇALHO DO CARD */}
      <button
        onClick={onToggle}
        className="gf-touch flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-black text-muted-foreground">
          {index}
        </span>
        {exercise.thumbUrl ? (
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.06]">
            <Image src={exercise.thumbUrl} alt="" fill sizes="48px" className="object-cover" />
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <FitnessIcon glyph={glyph} size={24} variant={allDone ? "success" : "brand"} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[13px] font-bold", allDone ? "text-muted-foreground line-through" : "text-foreground")}>
            {exercise.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {exercise.sets} séries · {exercise.reps} reps
            {allDone ? <span className="ml-1.5 font-bold text-success">· concluído</span> : doneCount > 0 ? <span className="ml-1.5 font-bold text-brand">· {doneCount}/{exercise.sets}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {allDone ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-black">
              <Check className="h-4 w-4" />
            </span>
          ) : null}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* CORPO EXPANSÍVEL */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pb-4">
              {/* Mini ações */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onDetail}
                  className="gf-touch flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" /> Ficha
                </button>
                {(exercise.videoUrlMale ?? exercise.videoUrl ?? exercise.videoUrlFemale) ? (
                  <button
                    onClick={onVideo}
                    className="gf-touch flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Vídeo
                  </button>
                ) : null}
              </div>

              {/* SÉRIES */}
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                      s.done ? "border-success/40 bg-success/[0.08]" : "border-border bg-card/40"
                    )}
                  >
                    <button
                      onClick={() => onToggleSet(i)}
                      aria-label={s.done ? `Desmarcar série ${i + 1}` : `Marcar série ${i + 1}`}
                      className={cn(
                        "gf-touch flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        s.done
                          ? "border-success bg-success text-black shadow-[0_0_10px_rgba(34,197,94,0.35)]"
                          : "border-border text-muted-foreground hover:border-brand/50"
                      )}
                    >
                      <Check className={cn("h-4 w-4", s.done && "stroke-[3]")} />
                    </button>
                    <span className="text-[12px] font-bold text-muted-foreground">Série {i + 1}</span>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={s.reps}
                        onChange={(e) => onRepsChange(i, e.target.value)}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm font-bold text-foreground outline-none focus:border-brand"
                        aria-label={`Repetições série ${i + 1}`}
                      />
                      <span className="text-[11px] text-muted-foreground">reps</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* AÇÕES RÁPIDAS */}
              <div className="flex items-center gap-2">
                {noneDone ? (
                  <button
                    onClick={() => onMarkAll(true)}
                    className="gf-touch flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-[12px] font-black text-brand-foreground shadow-lg shadow-brand/25"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Marcar todas
                  </button>
                ) : (
                  <button
                    onClick={() => onMarkAll(false)}
                    className="gf-touch flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card/60 py-2.5 text-[12px] font-bold text-muted-foreground"
                  >
                    <X className="h-4 w-4" /> Desmarcar
                  </button>
                )}
              </div>

              {/* DESCANSO OPCIONAL */}
              {restLeft > 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[12px] font-bold text-brand">
                    <Timer className="h-4 w-4" />
                    Descanso {formatTime(restLeft)}
                  </span>
                  <button
                    onClick={onSkipRest}
                    className="text-[11px] font-bold text-brand underline-offset-2 hover:underline"
                  >
                    pular
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onStartRest(exercise.rest || 60)}
                  className="gf-touch flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card/40 py-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Clock className="h-3.5 w-3.5" /> Iniciar descanso de {exercise.rest || 60}s
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function isExerciseDone(progress?: ExerciseProgress): boolean {
  if (!progress) return false;
  return progress.sets.length > 0 && progress.sets.every((s) => s.done);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
