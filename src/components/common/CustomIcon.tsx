"use client";

import {
  Activity,
  BicepsFlexed,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Mountain,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * CustomIcon — ZERO emojis, ZERO assets externos.
 * Estética Linear/Whoop: Lucide com stroke da marca e preenchimento
 * translúcido sutil (efeito "glow tech"), nunca fill sólido/cartoon.
 */
const MAP: Record<string, LucideIcon> = {
  peito: Dumbbell,
  costas: Mountain,
  ombro: Zap,
  braco: BicepsFlexed,
  biceps: BicepsFlexed,
  triceps: Zap,
  antebraco: Activity,
  abdomen: Flame,
  core: Flame,
  perna: Footprints,
  quadriceps: Footprints,
  posterior: Footprints,
  gluteo: Activity,
  panturrilha: Footprints,
  cardio: HeartPulse,
};

export function CustomIcon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const key = name.toLowerCase();
  const Icon = MAP[key] ?? Dumbbell;
  return (
    <Icon
      className={className}
      width={size}
      height={size}
      strokeWidth={1.9}
      fill="none"
      style={{ color: "#F4711E", filter: "drop-shadow(0 0 4px rgba(244,113,30,0.25))" }}
      aria-hidden
    />
  );
}

/** Converte nome de conquista/exercício em grupo muscular pro ícone. */
export function groupForName(name: string): string {
  const n = name.toLowerCase();
  if (/supino|crucifixo|peito|peck/.test(n)) return "peito";
  if (/remada|puxada|costas|dorsal|barra fixa/.test(n)) return "costas";
  if (/ombro|desenvolvimento|elevação|elevacao/.test(n)) return "ombro";
  if (/rosca|bíceps|biceps/.test(n)) return "biceps";
  if (/tríceps|triceps|corda/.test(n)) return "triceps";
  if (/agachamento|leg press|extensora|flexora|perna|posterior/.test(n)) return "perna";
  if (/prancha|abdom|core/.test(n)) return "core";
  if (/esteira|bike|corrida|cardio/.test(n)) return "cardio";
  return "peito";
}
