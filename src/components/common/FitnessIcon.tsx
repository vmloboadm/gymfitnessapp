"use client";

import {
  Activity,
  Award,
  BicepsFlexed,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Coins,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  Gem,
  HeartPulse,
  Medal,
  Moon,
  Package,
  Ruler,
  Scale,
  Trophy,
  Zap,
  Apple,
  Utensils,
  FlaskConical,
  Pill,
  TrendingUp,
  Bike,
  Hand,
  Mountain,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * FitnessIcon — SISTEMA ÚNICO COERENTE (lucide outline, mesma família de todo o app).
 * Antes usava Game Icons detalhados (60 SVGs) que quebravam a coerência com o lucide minimalista.
 * Agora tudo é lucide 1.9 stroke, #F4711E, mesmo peso visual do BottomNav/Dashboard.
 */

export type FitnessGlyph =
  | "weight-lifting-up" | "weight-lifting-down" | "weight" | "weight-scale"
  | "biceps" | "chest" | "forearm" | "female-legs" | "muscle-up"
  | "muscular-torso"
  | "gym-bag" | "gloves" | "headband-knot" | "body-balance"
  | "run" | "running-shoe" | "cycling" | "heart-beats" | "high-kick"
  | "high-punch" | "boxing-ring" | "punching-bag"
  | "laurels-trophy" | "diamond-trophy" | "medallist" | "ribbon-medal"
  | "podium-winner" | "jewel-crown"
  | "flame" | "lightning-flame" | "health-potion" | "magic-potion" | "health-capsule"
  | "growth" | "measure-tape" | "kitchen-scale" | "calendar" | "checklist"
  | "alarm-clock" | "night-sleep" | "apple-core" | "banana" | "chicken-oven"
  | "pineapple" | "opened-food-can" | "converse-shoe" | "coins-pile";

/** Mapa glyph → ícone lucide (mesma família, traço 1.9, outline). */
const GLYPH_MAP: Record<FitnessGlyph, LucideIcon> = {
  "weight-lifting-up": Dumbbell,
  "weight-lifting-down": Dumbbell,
  weight: Dumbbell,
  "weight-scale": Scale,
  biceps: BicepsFlexed,
  chest: Dumbbell,
  forearm: Activity,
  "female-legs": Footprints,
  "muscle-up": Mountain,
  "muscular-torso": Dumbbell,
  "gym-bag": Package,
  gloves: Hand,
  "headband-knot": Timer,
  "body-balance": Activity,
  run: Footprints,
  "running-shoe": Footprints,
  cycling: Bike,
  "heart-beats": HeartPulse,
  "high-kick": Footprints,
  "high-punch": Hand,
  "boxing-ring": Trophy,
  "punching-bag": Package,
  "laurels-trophy": Trophy,
  "diamond-trophy": Gem,
  medallist: Award,
  "ribbon-medal": Medal,
  "podium-winner": Trophy,
  "jewel-crown": Crown,
  flame: Flame,
  "lightning-flame": Zap,
  "health-potion": FlaskConical,
  "magic-potion": FlaskConical,
  "health-capsule": Pill,
  growth: TrendingUp,
  "measure-tape": Ruler,
  "kitchen-scale": Scale,
  calendar: Calendar,
  checklist: ClipboardCheck,
  "alarm-clock": Clock,
  "night-sleep": Moon,
  "apple-core": Apple,
  banana: Apple,
  "chicken-oven": Utensils,
  pineapple: Apple,
  "opened-food-can": Package,
  "converse-shoe": Footprints,
  "coins-pile": Coins,
};

/** Exercício → glifo ÚNICO (chave exata, minúsculas, sem acento). */
const EXERCISE_MAP: Record<string, FitnessGlyph> = {
  "supino reto": "weight-lifting-up",
  "crucifixo com halteres": "muscular-torso",
  "desenvolvimento militar": "biceps",
  "elevacao lateral": "forearm",
  "rosca direta": "weight",
  "triceps corda": "gloves",
  "agachamento livre": "female-legs",
  "leg press": "body-balance",
  "cadeira extensora": "muscle-up",
  "mesa flexora": "headband-knot",
  "panturrilha em pe": "running-shoe",
  "prancha abdominal": "measure-tape",
  esteira: "run",
  bicicleta: "cycling",
};

const GROUP_MAP: Record<string, FitnessGlyph> = {
  peito: "muscular-torso",
  costas: "muscle-up",
  ombro: "biceps",
  braco: "weight-lifting-down",
  biceps: "biceps",
  triceps: "high-punch",
  antebraco: "forearm",
  abdomen: "measure-tape",
  core: "health-capsule",
  perna: "female-legs",
  quadriceps: "weight-lifting-up",
  posterior: "gloves",
  gluteo: "body-balance",
  panturrilha: "running-shoe",
  cardio: "run",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function fitnessForName(name: string, used?: Set<FitnessGlyph>): FitnessGlyph {
  const n = normalize(name);
  let glyph = EXERCISE_MAP[n];
  if (!glyph) {
    if (/esteira|corrid|cardio|remo|bike/.test(n)) glyph = "run";
    else if (/supino|crucifixo|peck|peito/.test(n)) glyph = "muscular-torso";
    else if (/rosca|biceps/.test(n)) glyph = "biceps";
    else if (/triceps|corda/.test(n)) glyph = "gloves";
    else if (/agachamento|leg press|extensora|flexora|perna|afundo/.test(n)) glyph = "female-legs";
    else if (/remada|puxada|barra fixa|dorsal/.test(n)) glyph = "muscle-up";
    else if (/elevacao|desenvolvimento|ombro/.test(n)) glyph = "biceps";
    else if (/prancha|abdom|core/.test(n)) glyph = "checklist";
    else glyph = "weight-lifting-up";
  }
  if (used?.has(glyph)) {
    const free = (Object.values(EXERCISE_MAP) as FitnessGlyph[]).find((g) => !used.has(g)) ?? (Object.values(GROUP_MAP) as FitnessGlyph[]).find((g) => !used.has(g));
    if (free) glyph = free;
  }
  used?.add(glyph);
  return glyph;
}

export { GROUP_MAP as FITNESS_GROUP_MAP };

/** Ícone coerente: lucide outline 1.9, #F4711E (brand) ou #33D17A (success), com glow sutil. */
export function FitnessIcon({
  glyph,
  size = 24,
  className = "",
  variant = "brand",
}: {
  glyph: FitnessGlyph;
  size?: number;
  className?: string;
  variant?: "brand" | "success";
}) {
  const Icon = GLYPH_MAP[glyph] ?? Dumbbell;
  const color = variant === "success" ? "#33D17A" : "#F4711E";
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={1.9}
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
      style={{
        color,
        filter: variant === "success" ? "drop-shadow(0 0 6px rgba(51,209,122,0.35))" : "drop-shadow(0 0 6px rgba(244,113,30,0.28))",
      }}
    />
  );
}
