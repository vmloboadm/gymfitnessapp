"use client";

import { FitnessIcon, fitnessForName } from "./FitnessIcon";

/**
 * CustomIcon — agora delega para FitnessIcon com avatares circulares
 * coloridos por grupo muscular. Sem emojis, sem SVGs amadores.
 */

export function CustomIcon({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return <FitnessIcon glyph={fitnessForName(name)} size={size} className={className} />;
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
