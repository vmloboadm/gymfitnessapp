"use client";

import {
  AbsIcon,
  BackIcon,
  BicepsIcon,
  CalvesIcon,
  CardioIcon,
  ChestIcon,
  DumbbellIcon,
  ForearmIcon,
  GlutesIcon,
  HamstringsIcon,
  LegsIcon,
  ShoulderIcon,
  TricepsIcon,
} from "./MuscleIcons";

/**
 * CustomIcon — ícones anatômicos por grupo muscular.
 * Mesma API anterior, mas agora com SVGs coerentes em vez de Lucide genérico.
 */

const MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  peito: ChestIcon,
  costas: BackIcon,
  ombro: ShoulderIcon,
  braco: BicepsIcon,
  biceps: BicepsIcon,
  triceps: TricepsIcon,
  antebraco: ForearmIcon,
  abdomen: AbsIcon,
  core: AbsIcon,
  perna: LegsIcon,
  quadriceps: LegsIcon,
  posterior: HamstringsIcon,
  gluteo: GlutesIcon,
  panturrilha: CalvesIcon,
  cardio: CardioIcon,
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
  const Icon = MAP[key] ?? DumbbellIcon;
  return (
    <Icon
      size={size}
      className={className}
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
