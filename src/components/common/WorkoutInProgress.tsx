"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { iconForExercise, type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { cn } from "~/lib/utils";

type WExercise = {
  id: string;
  name: string;
  picto: string;
  sets: number;
  reps: string;
  rest: number;
  done?: boolean;
  info?: string | null;
  tips?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Treino em andamento — DINÂMICA SIMPLES (checklist sequencial):
 * exercício atual em destaque → "Concluído" avança pro próximo →
 * ao marcar o último, o botão vira "Finalizar treino".
 * Sem cronômetro de descanso, sem steps.
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
}: {
  exercises: WExercise[];
  onFinish: () => void;
}) {
  const [doneCount, setDoneCount] = useState(0);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const current = exercises[doneCount];
  const allDone = doneCount >= exercises.length;


  useEffect(() => {
    if (!allDone) return;
    navigator.vibrate?.([60, 40, 60]);
  }, [allDone]);

  // harden: lista vazia nunca quebra — oferece encerrar direto
  if (!exercises || exercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Nenhum exercício nesta sessão</p>
        <button
          onClick={() => { navigator.vibrate?.(40); onFinish(); }}
          className="gf-touch rounded-xl border border-border px-6 py-3 text-sm font-bold text-foreground"
        >
          Voltar
        </button>
      </div>
    );
  }

  const markCurrent = () => {
    navigator.vibrate?.(35);
    setDoneCount((c) => Math.min(exercises.length, c + 1));
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* progresso simples */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Treino em andamento</span>
            <span>{doneCount}/{exercises.length} concluídos</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-brand"
              animate={{ width: `${(doneCount / exercises.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-5 p-4 pb-8">
        {/* CHECKLIST */}
        <div className="space-y-2">
          {exercises.map((e, i) => {
            const done = i < doneCount;
            const isNow = i === doneCount && !allDone;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  done ? "border-success/40 bg-success/[0.08]" : isNow ? "border-brand/50 bg-brand/[0.07]" : "border-border bg-card/40 opacity-70"
                )}
              >
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setDetailEx({ name: e.name, info: e.info ?? null, tips: e.tips ?? null, imageUrl: e.imageUrl ?? null, videoUrl: e.videoUrl ?? null });
                  }}
                  aria-label={`Ficha de ${e.name}`}
                  className="gf-touch tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  <Info className="h-4 w-4" />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-brand">
                  {(() => { const I = iconForExercise(e.name); return <I className="h-5 w-5" />; })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-semibold", done ? "text-muted-foreground line-through" : "text-foreground")}>
                    {e.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.sets} × {e.reps}
                    {isNow ? <span className="ml-1.5 font-bold text-brand">· agora</span> : null}
                  </p>
                </div>
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : isNow ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-brand" />
                ) : null}
              </motion.div>
            );
          })}
        </div>

        {/* AÇÃO ÚNICA contextual */}
        {!allDone && current ? (
          <>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="overflow-hidden rounded-[22px] border border-brand/40 bg-gradient-to-b from-brand/20 via-card to-card p-6 text-center"
            >
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-card/70 text-brand shadow-inner">
                {(() => { const I = iconForExercise(current.name); return <I className="h-11 w-11" />; })()}
              </span>
              <h1 className="mt-3 text-xl font-black leading-tight text-foreground">{current.name}</h1>
              <p className="mt-1 gf-card-text">{current.sets} × {current.reps} no seu ritmo</p>
            </motion.div>

            <button
              onClick={markCurrent}
              className="gf-touch flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-lg font-black text-brand-foreground shadow-lg shadow-brand/30 transition-transform active:scale-[0.98]"
            >
              <Check className="h-5 w-5" />
              Concluído: {current.name.split(" ")[0]}
            </button>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-[22px] border border-success/40 bg-gradient-to-b from-success/15 to-card p-6 text-center"
            >
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h2 className="mt-2 text-lg font-black text-foreground">Todos os exercícios prontos!</h2>
              <p className="mt-1 gf-card-text">Toque abaixo pra registrar esse treino.</p>
            </motion.div>
            <button
              onClick={() => {
                navigator.vibrate?.(60);
                onFinish();
              }}
              className="gf-touch flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-4 text-lg font-black text-black shadow-lg shadow-success/30 transition-transform active:scale-[0.98]"
            >
              Finalizar treino
            </button>
          </>
        )}

        {/* próximo */}
        {!allDone && exercises[doneCount + 1] ? (
          <p className="text-center text-xs text-muted-foreground">
            Próximo: <span className="font-semibold text-foreground">{exercises[doneCount + 1].name}</span>
          </p>
        ) : null}

        <BottomSheet open={!!detailEx} onClose={() => setDetailEx(null)}>
          {detailEx ? (
            <>
              <h3 className="mb-3 text-base font-black text-foreground">{detailEx.name}</h3>
              <p className="gf-card-text">{detailEx.info ?? "Execução padrão, cadência controlada."}</p>
              {detailEx.videoUrl ? (
                <a
                  href={detailEx.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gf-touch mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-brand"
                >
                  Ver vídeo no YouTube
                </a>
              ) : null}
            </>
          ) : null}
        </BottomSheet>
      </div>
    </div>
  );
}
