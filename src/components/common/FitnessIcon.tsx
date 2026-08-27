"use client";

import { cn } from "~/lib/utils";
import {
  AbsIcon,
  BackIcon,
  BarbellIcon,
  BicepsIcon,
  CableIcon,
  CalvesIcon,
  CardioIcon,
  ChecklistIcon,
  ChestIcon,
  DumbbellIcon,
  FlameIcon,
  ForearmIcon,
  GlutesIcon,
  HamstringsIcon,
  LegsIcon,
  PullupIcon,
  RunIcon,
  ShoulderIcon,
  TricepsIcon,
  TrophyIcon,
  ScaleIcon,
  CalendarIcon,
} from "./MuscleIcons";

/**
 * FitnessIcon — ícones anatômicos e de movimento, coerentes com o exercício.
 * Cada glifo representa o grupo muscular ou o padrão de movimento, não um emoji genérico.
 */

export type FitnessGlyph =
  | "chest" | "chest-incline" | "chest-decline" | "chest-fly"
  | "back" | "back-lat" | "back-row" | "pullup"
  | "shoulder" | "shoulder-press" | "shoulder-lateral"
  | "biceps" | "biceps-curl" | "hammer-curl"
  | "triceps" | "triceps-pushdown" | "triceps-extension"
  | "forearm" | "forearm-wrist"
  | "legs" | "legs-squat" | "legs-press" | "legs-extension"
  | "hamstrings" | "hamstrings-curl" | "stiff"
  | "glutes" | "glutes-hip" | "glutes-abductor"
  | "calves" | "calves-standing" | "calves-seated"
  | "abs" | "abs-crunch" | "abs-plank"
  | "cardio" | "run" | "bike" | "rower"
  | "dumbbell" | "barbell" | "cable"
  | "flame" | "trophy" | "scale" | "calendar" | "checklist";

const GLYPH_MAP: Record<FitnessGlyph, React.ComponentType<{ size?: number; className?: string }>> = {
  chest: ChestIcon,
  "chest-incline": ChestIcon,
  "chest-decline": ChestIcon,
  "chest-fly": ChestIcon,
  back: BackIcon,
  "back-lat": BackIcon,
  "back-row": BackIcon,
  pullup: PullupIcon,
  shoulder: ShoulderIcon,
  "shoulder-press": ShoulderIcon,
  "shoulder-lateral": ShoulderIcon,
  biceps: BicepsIcon,
  "biceps-curl": BicepsIcon,
  "hammer-curl": BicepsIcon,
  triceps: TricepsIcon,
  "triceps-pushdown": TricepsIcon,
  "triceps-extension": TricepsIcon,
  forearm: ForearmIcon,
  "forearm-wrist": ForearmIcon,
  legs: LegsIcon,
  "legs-squat": LegsIcon,
  "legs-press": LegsIcon,
  "legs-extension": LegsIcon,
  hamstrings: HamstringsIcon,
  "hamstrings-curl": HamstringsIcon,
  stiff: HamstringsIcon,
  glutes: GlutesIcon,
  "glutes-hip": GlutesIcon,
  "glutes-abductor": GlutesIcon,
  calves: CalvesIcon,
  "calves-standing": CalvesIcon,
  "calves-seated": CalvesIcon,
  abs: AbsIcon,
  "abs-crunch": AbsIcon,
  "abs-plank": AbsIcon,
  cardio: CardioIcon,
  run: RunIcon,
  bike: RunIcon,
  rower: PullupIcon,
  dumbbell: DumbbellIcon,
  barbell: BarbellIcon,
  cable: CableIcon,
  flame: FlameIcon,
  trophy: TrophyIcon,
  scale: ScaleIcon,
  calendar: CalendarIcon,
  checklist: ChecklistIcon,
};

const EXERCISE_MAP: Record<string, FitnessGlyph> = {
  // Peito
  "supino reto": "chest",
  "supino inclinado": "chest-incline",
  "supino declinado": "chest-decline",
  "crucifixo com halteres": "chest-fly",
  "crucifixo maquina": "chest-fly",
  "crucifixo máquina": "chest-fly",
  voador: "chest-fly",
  "peck deck": "chest-fly",
  "fundos paralelas": "chest",
  "flexao de braco": "chest",
  "flexão de braço": "chest",
  // Costas
  "puxada alta": "back-lat",
  "pulldown pronado": "back-lat",
  "pulldown supinado": "back-lat",
  "puxada triangulo": "back-lat",
  "puxada frente aberta": "back-lat",
  "remada curvada": "back-row",
  "remada baixa": "back-row",
  "remada cavalinho": "back-row",
  "barra fixa": "pullup",
  // Ombro
  "desenvolvimento militar": "shoulder-press",
  "desenvolvimento": "shoulder-press",
  "elevacao lateral": "shoulder-lateral",
  "elevação lateral": "shoulder-lateral",
  "elevacao frontal": "shoulder-lateral",
  "elevação frontal": "shoulder-lateral",
  // Bíceps
  "rosca direta": "biceps-curl",
  "rosca martelo": "hammer-curl",
  "rosca scott": "biceps-curl",
  "rosca concentrada": "biceps-curl",
  // Tríceps
  "triceps corda": "triceps-pushdown",
  "tríceps corda": "triceps-pushdown",
  "triceps pulley": "triceps-pushdown",
  "tríceps pulley": "triceps-pushdown",
  "triceps testa": "triceps-extension",
  "tríceps testa": "triceps-extension",
  // Antebraço
  "rosca de punho": "forearm-wrist",
  "rosca inversa": "forearm-wrist",
  // Pernas
  "agachamento livre": "legs-squat",
  "agachamento smith": "legs-squat",
  "agachamento sumo": "legs-squat",
  "leg press": "legs-press",
  "leg press 45": "legs-press",
  "cadeira extensora": "legs-extension",
  "extensao tradicional": "legs-extension",
  // Posterior
  "mesa flexora": "hamstrings-curl",
  "cadeira flexora": "hamstrings-curl",
  stiff: "stiff",
  "bom dia": "stiff",
  // Glúteos
  "cadeira abdutora": "glutes-abductor",
  "elevacao pelvica": "glutes-hip",
  "elevação pélvica": "glutes-hip",
  // Panturrilha
  "panturrilha em pe": "calves-standing",
  "panturrilha sentado": "calves-seated",
  // Abdômen
  "prancha abdominal": "abs-plank",
  "prancha isometrica": "abs-plank",
  "prancha lateral": "abs-plank",
  "abdominal maquina": "abs-crunch",
  "abdominal máquina": "abs-crunch",
  "crunch solo": "abs-crunch",
  "crunch no solo": "abs-crunch",
  "elevacao de perna": "abs-crunch",
  "elevação de perna": "abs-crunch",
  // Cardio
  esteira: "run",
  corrida: "run",
  bicicleta: "bike",
  bike: "bike",
  remador: "rower",
};

const GROUP_MAP: Record<string, FitnessGlyph> = {
  peito: "chest",
  costas: "back",
  ombro: "shoulder",
  braco: "biceps",
  biceps: "biceps",
  triceps: "triceps",
  antebraco: "forearm",
  abdomen: "abs",
  core: "abs",
  perna: "legs",
  quadriceps: "legs",
  posterior: "hamstrings",
  gluteo: "glutes",
  panturrilha: "calves",
  cardio: "cardio",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Pool de glyphs para fallback sem repetição na mesma lista. */
const FALLBACK_POOL: FitnessGlyph[] = [
  "chest", "back", "shoulder", "biceps", "triceps", "forearm",
  "legs", "hamstrings", "glutes", "calves", "abs", "cardio",
  "dumbbell", "barbell", "cable", "flame", "trophy", "scale",
];

export function fitnessForName(name: string, used?: Set<FitnessGlyph>): FitnessGlyph {
  const n = normalize(name);
  let glyph = EXERCISE_MAP[n];

  if (!glyph) {
    if (/supino|crucifixo|voador|peck|fundos|flexao/.test(n)) glyph = "chest";
    else if (/puxada|pulldown|remada|barra fixa|dorsal/.test(n)) glyph = "back";
    else if (/desenvolvimento|elevacao|ombro/.test(n)) glyph = "shoulder";
    else if (/rosca|biceps/.test(n)) glyph = "biceps";
    else if (/triceps/.test(n)) glyph = "triceps";
    else if (/punho|antebraco/.test(n)) glyph = "forearm";
    else if (/agachamento|leg press|extensora|cadeira extensora/.test(n)) glyph = "legs";
    else if (/flexora|mesa flexora|stiff|bom dia/.test(n)) glyph = "hamstrings";
    else if (/abdutora|pelvica|gluteo|sumo/.test(n)) glyph = "glutes";
    else if (/panturrilha/.test(n)) glyph = "calves";
    else if (/prancha|abdominal|crunch|elevacao de perna/.test(n)) glyph = "abs";
    else if (/esteira|corrida|bike|bicicleta|remador|eliptico/.test(n)) glyph = "cardio";
    else if (/halter/.test(n)) glyph = "dumbbell";
    else if (/barra/.test(n)) glyph = "barbell";
    else if (/cabo|polia|corda/.test(n)) glyph = "cable";
    else glyph = "dumbbell";
  }

  if (used?.has(glyph)) {
    const hash = n.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < FALLBACK_POOL.length; i++) {
      const candidate = FALLBACK_POOL[(hash + i) % FALLBACK_POOL.length]!;
      if (!used.has(candidate)) {
        glyph = candidate;
        break;
      }
    }
  }
  used?.add(glyph);
  return glyph;
}

export { GROUP_MAP as FITNESS_GROUP_MAP };

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
  const Icon = GLYPH_MAP[glyph] ?? DumbbellIcon;
  const color = variant === "success" ? "#33D17A" : "#F4711E";
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ color, filter: variant === "success" ? "drop-shadow(0 0 5px rgba(51,209,122,0.35))" : "drop-shadow(0 0 5px rgba(244,113,30,0.25))" }}
    >
      <Icon size={size} />
    </span>
  );
}
