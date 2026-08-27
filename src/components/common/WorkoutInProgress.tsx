"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, ChevronLeft, Info, PlayCircle, Timer, Undo2, X } from "lucide-react";
import { type ExerciseDetail } from "~/components/common/ExerciseInfoSheet";
import { FitnessIcon, fitnessForName } from "~/components/common/FitnessIcon";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { ExerciseVideoModal } from "~/components/common/ExerciseVideoModal";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { useReducedMotion } from "~/hooks/useReducedMotion";

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
 * Treino em tempo real — Do screen (tarefa delimitada: completar a sessão).
 * Princípios aplicados (skill layout-motion-transitions + interaction-patterns):
 * - Uma ação primária dominante por região, que NUNCA some — só muda rótulo/cor no lugar (AnimatePresence mode=wait)
 * - Progresso com transform scaleX (sem reflow), respeita prefers-reduced-motion
 * - Descanso é feedback secundário acima da primária, não rouba o botão
 * - Checklist é overview denso, não a interação principal — tocar só abre ficha/vídeo, avanço é pelo footer
 * - Escape hatch visível (Sair) + wayfinding (passo X/Y + dots)
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
}: {
  exercises: WExercise[];
  onFinish: () => void;
}) {
  const [doneCount, setDoneCount] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [detailEx, setDetailEx] = useState<ExerciseDetail | null>(null);
  const [videoEx, setVideoEx] = useState<{ name: string; poster?: string | null; url: string } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const reduce = useReducedMotion();
  const current = exercises[doneCount];
  const allDone = doneCount >= exercises.length;
  const progress = exercises.length ? doneCount / exercises.length : 0;

  useEffect(() => {
    if (!allDone) return;
    navigator.vibrate?.([60, 40, 60]);
  }, [allDone]);

  useEffect(() => {
    if (restLeft <= 0) return;
    const i = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [restLeft > 0]);

  if (!exercises || exercises.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Nenhum exercício nesta sessão</p>
        <button
          onClick={() => {
            navigator.vibrate?.(40);
            onFinish();
          }}
          className="tactile inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border px-6 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Voltar
        </button>
      </div>
    );
  }

  const markCurrent = () => {
    navigator.vibrate?.(35);
    const nextEx = exercises[doneCount + 1];
    if (nextEx?.rest) setRestLeft(nextEx.rest);
    setDoneCount((c) => Math.min(exercises.length, c + 1));
  };

  const undoLast = () => {
    if (doneCount === 0) return;
    navigator.vibrate?.(15);
    setDoneCount((c) => Math.max(0, c - 1));
    setRestLeft(0);
  };

  const glyph = current?.name ? fitnessForName(current.name) : "weight-lifting-up";

  // Estado do botão primário (nunca some, só morpha)
  const primaryState = allDone ? "finish" : restLeft > 0 ? "rest" : "next";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* HEADER fixo: wayfinding + progresso scaleX + escape */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="tactile inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Sair do treino"
          >
            <ChevronLeft className="h-4 w-4" />
            Sair
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold tracking-tight text-foreground">
              {allDone ? "Finalizado" : `${doneCount + 1} de ${exercises.length}`}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {allDone ? `${exercises.length} exercícios` : current?.name ?? ""}
            </span>
          </div>
          <span className="min-w-[48px] text-right text-xs font-medium text-muted-foreground">
            {doneCount}/{exercises.length}
          </span>
        </div>
        {/* barra de progresso: transform scaleX, nunca width */}
        <div className="h-1.5 overflow-hidden bg-muted">
          <motion.div
            className="h-full origin-left bg-brand"
            initial={false}
            animate={{ scaleX: progress }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
        {/* dots de passo (wayfinding) */}
        <div className="flex items-center justify-center gap-1.5 px-4 py-2">
          {exercises.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i < doneCount
                  ? "w-6 bg-success"
                  : i === doneCount
                    ? "w-8 bg-brand shadow-[0_0_8px_rgba(244,113,30,0.5)]"
                    : "w-1.5 bg-white/15"
              )}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 p-4 pb-28">
        {/* HERO do exercício atual — mora, não some, AnimatePresence mode wait */}
        <AnimatePresence mode="wait" initial={false}>
          {!allDone && current ? (
            <motion.div
              key={current.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden rounded-[22px] border border-[#F4711E]/30 bg-gradient-to-b from-[#F4711E]/10 via-card to-card shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            >
              <div className="p-5 text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.06] bg-[#0B1A33] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <FitnessIcon glyph={glyph} size={40} />
                </span>
                <h1 className="mt-3 text-xl font-black leading-tight tracking-tight text-foreground">
                  {current.name}
                </h1>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {current.sets} séries · {current.reps} reps · descanso {current.rest}s
                </p>
                {current.info ? (
                  <p className="mx-auto mt-2 max-w-[32ch] text-xs leading-relaxed text-[#C8D4EA]">
                    {current.info}
                  </p>
                ) : null}

                {/* ações secundárias próximas ao objeto */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setDetailEx({ name: current.name, info: current.info ?? null, tips: current.tips ?? null, imageUrl: current.imageUrl ?? null, videoUrl: current.videoUrl ?? null })}
                    className="tactile inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-white/[0.04] px-3.5 text-xs font-semibold text-[#B8C4D8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Ficha
                  </button>
                  <button
                    onClick={() => {
                      const url = current.videoUrlMale ?? current.videoUrl ?? current.videoUrlFemale;
                      if (url) setVideoEx({ name: current.name, poster: current.thumbUrl ?? current.imageUrl ?? null, url });
                    }}
                    className="tactile inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand/15 px-3.5 text-xs font-bold text-brand hover:bg-brand/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Ver execução
                  </button>
                </div>

                {/* AÇÃO PRIMÁRIA NO CARD — sem precisar scrollar até o footer */}
                <button
                  onClick={markCurrent}
                  className="tactile mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F4711E] text-[15px] font-black tracking-tight text-black shadow-[0_4px_12px_rgba(244,113,30,0.35)] hover:bg-[#FF7A2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
                >
                  <Check className="h-5 w-5" />
                  Marcar como feito
                </button>
              </div>

              {/* descanso como barra secundária, NÃO rouba a primária */}
              <AnimatePresence>
                {restLeft > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-brand/20 bg-brand/10"
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-xs font-bold text-brand">
                        <Timer className="h-4 w-4" />
                        Descanso {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
                      </span>
                      <button
                        onClick={() => {
                          navigator.vibrate?.(15);
                          setRestLeft(0);
                        }}
                        className="tactile text-xs font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        Pular →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : allDone ? (
            <motion.div
              key="done"
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="rounded-[22px] border border-success/30 bg-gradient-to-b from-success/15 via-card to-card p-6 text-center"
            >
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h2 className="mt-3 text-lg font-black text-foreground">Treino concluído!</h2>
              <p className="mx-auto mt-1 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                Mandou bem — {exercises.length} exercícios finalizados. Registre pra manter a sequência.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* CHECKLIST overview — tabela densa, não carrossel, sem layout animation pesada */}
        <section aria-label="Progresso do treino">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Progresso
          </h2>
          <div className="space-y-2">
            {exercises.map((e, i) => {
              const done = i < doneCount;
              const isNow = i === doneCount && !allDone;
              return (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    done
                      ? "border-success/30 bg-success/[0.07]"
                      : isNow
                        ? "border-brand/40 bg-brand/[0.08] shadow-[0_0_0_1px_rgba(244,113,30,0.15)]"
                        : "border-white/[0.06] bg-white/[0.03]"
                  )}
                >
                  {/* thumb */}
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/[0.06]">
                    <Image src={e.thumbUrl ?? "/workout/workout-strength.jpg"} alt="" fill sizes="48px" className="object-cover" />
                    {done && <span className="absolute inset-0 bg-success/20" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-semibold", done ? "text-muted-foreground line-through" : isNow ? "text-white" : "text-[#C8D4EA]")}>
                      {e.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.sets}×{e.reps}
                      {isNow && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand">agora</span>}
                      {done && <span className="ml-2 text-[10px] font-bold text-success">✓ feito</span>}
                    </p>
                  </div>
                  {/* desfazer só no último feito — evita confusão */}
                  {done && i === doneCount - 1 ? (
                    <button
                      onClick={undoLast}
                      aria-label={`Desfazer ${e.name}`}
                      className="tactile inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  ) : done ? (
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <ExerciseVideoModal open={!!videoEx} onClose={() => setVideoEx(null)} name={videoEx?.name ?? ""} poster={videoEx?.poster ?? null} videoUrl={videoEx?.url ?? null} />
        <BottomSheet open={!!detailEx} onClose={() => setDetailEx(null)}>
          {detailEx ? (
            <>
              <h3 className="mb-3 text-base font-black text-foreground">{detailEx.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{detailEx.info ?? "Execução padrão, cadência controlada."}</p>
              {detailEx.videoUrl ? (
                <a href={detailEx.videoUrl} target="_blank" rel="noopener noreferrer" className="tactile mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-brand hover:border-brand/40">
                  Ver vídeo no YouTube
                </a>
              ) : null}
            </>
          ) : null}
        </BottomSheet>
      </div>

      {/* FOOTER — definitivo: só Finalizar (quando completo) ou descanso. Marcar fica no card (sem scroll) */}
      <div className="sticky bottom-0 z-10 border-t border-white/[0.06] bg-[#050507]/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            {primaryState === "finish" ? (
              <motion.button
                key="finish"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                onClick={() => {
                  navigator.vibrate?.(60);
                  onFinish();
                }}
                className="tactile flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-success text-[16px] font-black tracking-tight text-black shadow-[0_8px_20px_rgba(51,209,122,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
              >
                <Check className="h-5 w-5" />
                Finalizar treino — único ponto de conclusão
              </motion.button>
            ) : primaryState === "rest" ? (
              <motion.div
                key="rest"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-brand">
                  <Timer className="h-4 w-4" />
                  Descanso {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
                </span>
                <button
                  onClick={() => {
                    navigator.vibrate?.(15);
                    setRestLeft(0);
                  }}
                  className="text-xs font-bold text-brand underline-offset-4 hover:underline"
                >
                  Pular descanso →
                </button>
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                ↑ Toque em <span className="font-bold text-[#F4711E]">Marcar como feito</span> no card acima
              </motion.p>
            )}
          </AnimatePresence>
          <p className="mt-2 text-center text-[10px] font-medium tracking-wide text-white/40">
            {allDone ? "Conclusão definitiva aqui" : `${doneCount} de ${exercises.length} • progresso salvo automaticamente`}
          </p>
        </div>
      </div>

      {/* Exit confirm — evita perda acidental (segurança) */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B1A33] p-5 shadow-2xl">
              <h3 className="text-base font-bold text-white">Sair do treino?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Seu progresso ({doneCount}/{exercises.length}) ficará salvo e você pode retomar marcando de novo.</p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => setShowExitConfirm(false)} className="tactile flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white hover:bg-white/5">Continuar</button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onFinish();
                  }}
                  className="tactile flex-1 rounded-xl bg-white py-3 text-sm font-bold text-black hover:bg-white/90"
                >
                  Sair
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
