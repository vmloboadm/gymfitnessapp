"use client";

import { cn } from "~/lib/utils";

/**
 * FitnessIcon — Game Icons (CC-BY 3.0) em /icons/fitness/, tingidos de #F4711E.
 * REGRA: cada exercício tem SEU próprio glifo — sem repetição entre
 * exercícios diferentes na mesma lista. Grupos musculares também únicos.
 */

export type FitnessGlyph =
  // treino
  | "weight-lifting-up" | "weight-lifting-down" | "weight" | "weight-scale"
  | "biceps" | "chest" | "forearm" | "female-legs" | "muscle-up"
  | "muscular-torso"
  | "gym-bag" | "gloves" | "headband-knot" | "body-balance"
  // cardio/luta
  | "run" | "running-shoe" | "cycling" | "heart-beats" | "high-kick"
  | "high-punch" | "boxing-ring" | "punching-bag"
  // conquistas/ranking
  | "laurels-trophy" | "diamond-trophy" | "medallist" | "ribbon-medal"
  | "podium-winner" | "jewel-crown"
  // gamificação/energia
  | "flame" | "lightning-flame" | "health-potion" | "magic-potion" | "health-capsule"
  // métricas/rotina/nutrição/perfil
  | "growth" | "measure-tape" | "kitchen-scale" | "calendar" | "checklist"
  | "alarm-clock" | "night-sleep" | "apple-core" | "banana" | "chicken-oven"
  | "pineapple" | "opened-food-can" | "converse-shoe" | "coins-pile";

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

/** Grupo muscular → glifo único (fallback por categoria). */
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

/** Resolve glifo por nome de exercício; nunca repete dentro de uma lista:
 *  passe `used` (Set mutável) para exclusão mútua. */
export function fitnessForName(
  name: string,
  used?: Set<FitnessGlyph>
): FitnessGlyph {
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

  // exclusão mútua: se já foi usado na lista, escolhe outro livre
  if (used?.has(glyph)) {
    const free =
      (Object.values(EXERCISE_MAP) as FitnessGlyph[]).find((g) => !used.has(g)) ??
      (Object.values(GROUP_MAP) as FitnessGlyph[]).find((g) => !used.has(g));
    if (free) glyph = free;
  }
  used?.add(glyph);
  return glyph;
}

export { GROUP_MAP as FITNESS_GROUP_MAP };

/** SVG local já com fill #F4711E (sem fundo preto). Brilha no dark. */
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
  // SVGs já são laranja; success vira verde via hue-rotate
  const style: React.CSSProperties =
    variant === "success"
      ? { filter: "hue-rotate(85deg) saturate(1.4) brightness(1.05)", opacity: 0.98 }
      : { opacity: 0.98, filter: "drop-shadow(0 0 6px rgba(244,113,30,0.25))" };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/fitness/${glyph}.svg`}
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
      style={style}
    />
  );
}
