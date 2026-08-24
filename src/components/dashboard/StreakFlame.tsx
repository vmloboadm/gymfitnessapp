"use client";

import { Flame } from "lucide-react";
import { cn } from "~/lib/utils";
import { useReducedMotion } from "~/hooks/useReducedMotion";

/* Estágios do fogo (degraus claros, não crescimento contínuo). */
export const FLAME_STAGES = [
  { min: 0, name: "Brasa" },
  { min: 4, name: "Chama média" },
  { min: 8, name: "Fogo alto" },
  { min: 15, name: "Fogueira" },
] as const;

export function streakStage(streak: number) {
  const idx = [...FLAME_STAGES].reverse().find((s) => streak >= s.min) ?? FLAME_STAGES[0];
  const stageIdx = FLAME_STAGES.findIndex((s) => s === idx);
  const next = FLAME_STAGES[stageIdx + 1] ?? null;
  return {
    name: idx.name,
    idx: stageIdx,
    nextName: next?.name ?? null,
    daysToNext: next ? Math.max(0, next.min - streak) : 0,
  };
}

/* Intensidade visual por estágio: tamanho, tom e preenchimento da chama. */
const STAGE_LOOK = [
  { scale: 0.74, color: "#9AA5B8", glow: 0 },
  { scale: 0.9, color: "#FFA36B", glow: 4 },
  { scale: 1.05, color: "#FF8A3C", glow: 8 },
  { scale: 1.22, color: "#F4711E", glow: 14 },
];

/** Chama do streak, ícone Lucide com variação de intensidade por estágio.
    Streak baixo = apagada/cinza; streak alto = viva e maior. */
export function StreakFlame({ streak, size = 42 }: { streak: number; size?: number }) {
  const stage = streakStage(streak);
  const look = STAGE_LOOK[stage.idx];
  const reduced = useReducedMotion();
  const dim = Math.round(size * look.scale);

  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Flame
        style={{
          width: dim,
          height: dim,
          color: look.color,
          filter: look.glow ? `drop-shadow(0 0 ${look.glow}px ${look.color})` : undefined,
          animation: reduced ? undefined : "flame-flicker 0.9s ease-in-out infinite",
          transformOrigin: "50% 90%",
        }}
        strokeWidth={1.75}
        fill={look.color}
        fillOpacity={0.28 + stage.idx * 0.18}
      />
    </span>
  );
}

export function FlameStageHint({ streak }: { streak: number }) {
  const stage = streakStage(streak);
  return (
    <p className={cn("text-center text-[10px] font-medium leading-snug", stage.nextName ? "text-[#6E7A90]" : "text-[#FFC24D]")}>
      {stage.nextName
        ? stage.daysToNext === 0
          ? `Próximo estágio: ${stage.nextName.toLowerCase()}`
          : `Faltam ${stage.daysToNext} ${stage.daysToNext === 1 ? "dia" : "dias"} para ${stage.nextName.toLowerCase()}`
        : "Nível máximo alcançado!"}
    </p>
  );
}
