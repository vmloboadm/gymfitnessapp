"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCircle2, ChevronRight, Info, PlayCircle, Timer } from "lucide-react";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import Image from "next/image";
import { cn } from "~/lib/utils";

type WExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  done?: boolean;
  info?: string | null;
  tips?: string[] | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  videoUrlMale?: string | null;
  videoUrlFemale?: string | null;
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
  const [restLeft, setRestLeft] = useState(0); // segundos de descanso
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const current = exercises[doneCount];
  const allDone = doneCount >= exercises.length;


  useEffect(() => {
    if (!allDone) return;
    navigator.vibrate?.([60, 40, 60]);
  }, [allDone]);

  // descanso automático após concluir um exercício
  useEffect(() => {
    if (restLeft <= 0) return;
    const i = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [restLeft > 0]);

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
    const nextEx = exercises[doneCount + 1];
    setRestLeft(nextEx?.rest ?? 60);
    setDoneCount((c) => Math.min(exercises.length, c + 1));
  };

  const glyph = current?.name ? fitnessForName(current.name) : "weight-lifting-up";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* progresso simples — fonte única do contador */}
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

      <div className="mx-auto w-full max-w-md flex-1 space-y-3 p-4 pb-28">
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
                  done
                    ? "border-success/40 bg-success/[0.08]"
                    : isNow
                      ? "border-[#F4711E] bg-[#F4711E]/[0.06] shadow-[0_0_15px_rgba(244,113,30,0.3)]"
                      : "border-border bg-card/40 opacity-50"
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
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const url = e.videoUrlMale ?? e.videoUrl ?? e.videoUrlFemale;
                    if (url) setVideoEx({ name: e.name, poster: e.thumbUrl ?? e.imageUrl ?? null, url });
                  }}
                  aria-label={`Ver vídeo de ${e.name}`}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.08]"
                >
                  <Image
                    src={e.thumbUrl ?? "/workout/workout-strength.jpg"}
                    alt=""
                    fill
                    sizes="64px"
                    className={cn("object-cover", !isNow && "opacity-60")}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <PlayCircle className="h-6 w-6 text-white drop-shadow" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-semibold", done ? "text-muted-foreground line-through" : "text-foreground")}>
                    {e.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.sets} × {e.reps}
                    {isNow ? <span className="ml-1.5 font-bold text-[#F4711E]">· agora</span> : null}
                  </p>
                </div>
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : isNow ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#F4711E]" />
                ) : null}
              </motion.div>
            );
          })}
        </div>

        {/* CARD DO EXERCÍCIO ATIVO — destaque glow tech */}
        {!allDone && current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[22px] border border-[#F4711E] bg-gradient-to-b from-[#F4711E]/[0.10] via-card to-card p-5 text-center shadow-[0_0_15px_rgba(244,113,30,0.3)]"
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-card/70 shadow-inner">
              <FitnessIcon glyph={glyph} size={36} />
            </span>
            <h1 className="mt-2.5 text-lg font-black leading-tight text-foreground">{current.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{current.sets} × {current.reps} no seu ritmo</p>
          </motion.div>
        ) : allDone ? (
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-[22px] border border-success/40 bg-gradient-to-b from-success/15 to-card p-5 text-center"
          >
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-2 text-base font-black text-foreground">Todos os exercícios prontos!</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Toque abaixo pra registrar esse treino.</p>
          </motion.div>
        ) : null}

        <ExerciseVideoModal
          open={!!videoEx}
          onClose={() => setVideoEx(null)}
          name={videoEx?.name ?? ""}
          poster={videoEx?.poster ?? null}
          videoUrl={videoEx?.url ?? null}
        />
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

      {/* FOOTER FIXO — ação única, slim, sempre acessível */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          {allDone ? (
            <button
              onClick={() => {
                navigator.vibrate?.(60);
                onFinish();
              }}
              className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3.5 text-[15px] font-black text-black shadow-lg shadow-success/25 transition-transform active:scale-[0.98]"
            >
              <Check className="h-[18px] w-[18px]" />
              Finalizar treino
            </button>
          ) : current ? (
            restLeft > 0 ? (
              <button
                onClick={() => setRestLeft(0)}
                className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl border border-brand/50 bg-brand/10 py-3.5 text-[15px] font-black text-brand transition-transform active:scale-[0.98]"
              >
                <Timer className="h-[18px] w-[18px]" />
                Descanso {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
                <span className="text-[11px] font-semibold opacity-70">· pular</span>
              </button>
            ) : (
              <button
                onClick={markCurrent}
                className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4711E] py-3.5 text-[15px] font-black text-black shadow-[0_0_20px_rgba(244,113,30,0.35)] transition-transform active:scale-[0.98]"
              >
                <Check className="h-[18px] w-[18px]" />
                Concluído · {current.name.split(" ")[0]}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
