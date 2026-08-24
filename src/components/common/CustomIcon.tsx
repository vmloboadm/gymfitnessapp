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
 * CustomIcon — ZERO emojis, ZERO ícones genéricos para músculos.
 * Lucide PREENCHIDO na cor da marca. Quando os bonecos 3D chegarem em
 * /public/assets/custom-icons/, este componente passa a servir as imagens.
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
      strokeWidth={1.5}
      fill="currentColor"
      style={{ color: "#F4711E" }}
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
