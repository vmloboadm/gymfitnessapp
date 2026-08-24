"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { ProgressRing } from "~/components/ui/progress-ring";

type WExercise = {
  id: string;
  name: string;
  picto: string;
  sets: number;
  reps: string;
  rest: number;
  done?: boolean;
};

const LOAD_STEP = 2.5;

/* Sugestão inicial de carga estável por exercício (determinística, sem backend) */
function suggestedLoad(id: string): number {
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 10 + (sum % 13) * LOAD_STEP; // 10kg – 40kg
}

/**
 * Tela de treino EM ANDAMENTO (seção 2 do spec):
 * visualmente diferente do catálogo — exercício atual em destaque,
 * cronômetro de descanso automático, botão grande único "próximo".
 */
export default function WorkoutInProgress({
  exercises,
  onFinish,
}: {
  exercises: WExercise[];
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [setCount, setSetCount] = useState(1);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [loads, setLoads] = useState<Record<string, number>>({});

  const current = exercises[index];
  const isLast = index === exercises.length - 1;
  const baseLoad = suggestedLoad(current?.id ?? "x");
  const load = loads[current?.id ?? "x"] ?? baseLoad;

  const adjustLoad = (delta: number) => {
    navigator.vibrate?.(25);
    const id = current.id;
    setLoads((prev) => {
      const next = Math.max(0, Math.round(((prev[id] ?? suggestedLoad(id)) + delta) * 2) / 2);
      return { ...prev, [id]: next };
    });
  };

  // cronômetro de descanso (auto após tocar "série concluída")
  useEffect(() => {
    if (!resting) return;
    if (restLeft <= 0) {
      setResting(false);
      navigator.vibrate?.(150);
      return;
    }
    const t = setTimeout(() => setRestLeft((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resting, restLeft]);

  const finishSet = () => {
    navigator.vibrate?.(60);
    setRestLeft(current.rest);
    setResting(true);
    if (setCount < current.sets) {
      setSetCount(setCount + 1);
    } else {
      // último set do exercício → avança (ou encerra)
      if (isLast) {
        onFinish();
      } else {
        setIndex(index + 1);
        setSetCount(1);
        setResting(false);
        setRestLeft(0);
      }
    }
  };

  const skip = () => {
    if (isLast) onFinish();
    else {
      setIndex(index + 1);
      setSetCount(1);
      setResting(false);
      setRestLeft(0);
    }
  };

  const progress = ((index + (setCount - 1) / Math.max(current?.sets ?? 1, 1)) / exercises.length) * 100;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Progresso cerquilha */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Treino em andamento</span>
            <span>{index + 1}/{exercises.length} exercícios</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-brand"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-5 p-4">
        {/* Exercício atual em DESTAQUE */}
        {current && (
          <motion.div
            key={current.id + setCount}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="tactile overflow-hidden rounded-3xl border border-brand/40 bg-gradient-to-b from-brand/20 via-card to-card p-6 text-center"
          >
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-card/70 text-6xl shadow-inner">
              {current.picto}
            </span>
            <h1 className="mt-4 text-2xl font-black leading-tight text-foreground">{current.name}</h1>
            <p className="mt-1 gf-card-text">
              {current.sets} × {current.reps}
            </p>
            {/* Setes restantes */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: current.sets }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    i < setCount ? "bg-brand" : "bg-muted"
                  )}
                />
              ))}
              <span className="ml-2 gf-label !text-[11px]">sete {setCount}/{current.sets}</span>
            </div>

            {/* Carga de hoje — stepper toque a toque (haptics leve) */}
            <div className="mt-5 rounded-2xl border border-border bg-card/50 p-3">
              <p className="gf-label !text-[10px]">Carga de hoje</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button
                  onClick={() => adjustLoad(-LOAD_STEP)}
                  aria-label="Diminuir carga"
                  className="gf-touch tactile flex h-11 w-16 items-center justify-center rounded-xl border border-border bg-card text-2xl font-bold text-foreground transition-colors active:border-brand"
                >
                  −
                </button>
                <div className="min-w-[96px] text-center">
                  <motion.span
                    key={load}
                    initial={{ opacity: 0.35, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="gf-hero-num inline-block text-2xl"
                  >
                    {load.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </motion.span>
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">kg</span>
                </div>
                <button
                  onClick={() => adjustLoad(LOAD_STEP)}
                  aria-label="Aumentar carga"
                  className="gf-touch tactile flex h-11 w-16 items-center justify-center rounded-xl border border-border bg-card text-2xl font-bold text-foreground transition-colors active:border-brand"
                >
                  +
                </button>
              </div>
              {load !== baseLoad ? (
                <p className={cn("mt-1.5 text-center text-[10px] font-semibold", load > baseLoad ? "text-success" : "text-muted-foreground")}>
                  {load > baseLoad ? `+${(load - baseLoad).toLocaleString("pt-BR")} kg vs início` : `${(baseLoad - load).toLocaleString("pt-BR")} kg abaixo do início`}
                </p>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* Cronômetro de descanso — anel de assinatura contando regressivamente */}
        {resting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-5"
          >
            <ProgressRing
              value={Math.max(0, Math.min(100, (restLeft / Math.max(current.rest, 1)) * 100))}
              label={`${restLeft}`}
              size={92}
              strokeWidth={7}
            />
            <span className="gf-label flex items-center gap-1.5 text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" /> Descanso
            </span>
            <button onClick={() => { setResting(false); setRestLeft(0); }} className="gf-touch rounded-full border border-warning/40 px-4 py-1.5 text-xs font-semibold text-warning">
              Pular descanso
            </button>
          </motion.div>
        )}

        {/* Botão grande único */}
        <button
          onClick={finishSet}
          className={cn(
            "gf-touch flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black shadow-lg",
            resting
              ? "bg-success text-success-foreground shadow-success/30"
              : "bg-brand text-brand-foreground shadow-brand/30"
          )}
        >
          {resting ? (
            <>
              <CheckCircle2 className="h-5 w-5" /> Voltei! Próximo sete
            </>
          ) : isLast && setCount >= current.sets ? (
            <>
              <CheckCircle2 className="h-5 w-5" /> Finalizar treino
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> Concluir {setCount < current.sets ? `sete ${setCount}` : "exercício"}
            </>
          )}
        </button>

        <button onClick={skip} className="gf-touch mx-auto flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground">
          Pular exercício <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Lista compacta dos próximos */}
        <div className="gf-card bg-card/40">
          <p className="gf-label mb-2">Próximos</p>
          <div className="space-y-1.5">
            {exercises.slice(index + 1, index + 4).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-card/40 px-3 py-2">
                <span className="text-lg">{e.picto}</span>
                <span className="flex-1 text-[13px] font-medium text-foreground">{e.name}</span>
                <span className="gf-label !text-[10px]">{e.sets}×{e.reps}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}