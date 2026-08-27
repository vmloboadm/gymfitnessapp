"use client";

import { cn } from "~/lib/utils";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  BicepsFlexed,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  MoveVertical,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones profissionais de academia — sem emojis, sem SVGs amadores.
 *
 * Padrão inspirado em Strong/Hevy: avatares circulares coloridos por grupo muscular
 * (inicial + mini ícone Lucide) e ícones de equipamento minimalistas.
 */

export type FitnessGlyph =
  | "chest" | "back" | "shoulder" | "biceps" | "triceps" | "forearm"
  | "legs" | "hamstrings" | "glutes" | "calves" | "abs" | "cardio"
  | "dumbbell" | "barbell" | "machine" | "cable" | "bodyweight" | "timer";

const GROUP_META: Record<string, { label: string; initial: string; color: string; bg: string; icon: LucideIcon }> = {
  chest:         { label: "Peito",      initial: "P", color: "#F97316", bg: "rgba(249,115,22,0.14)", icon: Dumbbell },
  back:          { label: "Costas",     initial: "C", color: "#3B82F6", bg: "rgba(59,130,246,0.14)", icon: ArrowUpFromLine },
  shoulder:      { label: "Ombro",      initial: "O", color: "#FBBF24", bg: "rgba(251,191,36,0.14)", icon: ArrowUp },
  biceps:        { label: "Bíceps",     initial: "B", color: "#EF4444", bg: "rgba(239,68,68,0.14)", icon: BicepsFlexed },
  triceps:       { label: "Tríceps",    initial: "T", color: "#A855F7", bg: "rgba(168,85,247,0.14)", icon: ArrowDown },
  forearm:       { label: "Antebraço",  initial: "A", color: "#EC4899", bg: "rgba(236,72,153,0.14)", icon: MoveVertical },
  legs:          { label: "Pernas",     initial: "Q", color: "#22C55E", bg: "rgba(34,197,94,0.14)",  icon: Footprints },
  hamstrings:    { label: "Posterior",  initial: "H", color: "#16A34A", bg: "rgba(22,163,74,0.14)",  icon: Footprints },
  glutes:        { label: "Glúteos",    initial: "G", color: "#14B8A6", bg: "rgba(20,184,166,0.14)", icon: Footprints },
  calves:        { label: "Panturrilha",initial: "L", color: "#06B6D4", bg: "rgba(6,182,212,0.14)",  icon: Footprints },
  abs:           { label: "Abdômen",    initial: "K", color: "#F59E0B", bg: "rgba(245,158,11,0.14)", icon: Flame },
  cardio:        { label: "Cardio",     initial: "R", color: "#FB7185", bg: "rgba(251,113,133,0.14)", icon: HeartPulse },
  dumbbell:      { label: "Halter",     initial: "H", color: "#94A3B8", bg: "rgba(148,163,184,0.14)", icon: Dumbbell },
  barbell:       { label: "Barra",      initial: "B", color: "#94A3B8", bg: "rgba(148,163,184,0.14)", icon: Dumbbell },
  machine:       { label: "Máquina",    initial: "M", color: "#94A3B8", bg: "rgba(148,163,184,0.14)", icon: Activity },
  cable:         { label: "Cabo",       initial: "C", color: "#94A3B8", bg: "rgba(148,163,184,0.14)", icon: ArrowDown },
  bodyweight:    { label: "Livre",      initial: "L", color: "#94A3B8", bg: "rgba(148,163,184,0.14)", icon: Activity },
  timer:         { label: "Tempo",      initial: "T", color: "#F97316", bg: "rgba(249,115,22,0.14)", icon: Timer },
};

const EXERCISE_MAP: Record<string, FitnessGlyph> = {
  "supino reto": "chest",
  "supino inclinado": "chest",
  "supino declinado": "chest",
  "crucifixo com halteres": "chest",
  "crucifixo maquina": "chest",
  "crucifixo máquina": "chest",
  voador: "chest",
  "peck deck": "chest",
  "flexao de braco": "chest",
  "flexão de braço": "chest",
  "fundos paralelas": "chest",

  "puxada alta": "back",
  "pulldown pronado": "back",
  "pulldown supinado": "back",
  "puxada triangulo": "back",
  "puxada frente aberta": "back",
  "remada curvada": "back",
  "remada baixa": "back",
  "remada cavalinho": "back",
  "remada unilateral": "back",
  "barra fixa": "back",
  "barra fixa pronada": "back",
  "barra fixa supinada": "back",
  shruug: "back",

  "desenvolvimento militar": "shoulder",
  "desenvolvimento com halteres": "shoulder",
  "desenvolvimento arnold": "shoulder",
  "desenvolvimento na maquina": "shoulder",
  "elevacao lateral": "shoulder",
  "elevação lateral": "shoulder",
  "elevacao frontal": "shoulder",
  "elevação frontal": "shoulder",
  "elevacao lateral na polia": "shoulder",

  "rosca direta": "biceps",
  "rosca alternada": "biceps",
  "rosca scott": "biceps",
  "rosca concentrada": "biceps",
  "rosca martelo": "biceps",
  "rosca na polia baixa": "biceps",
  "rosca 21": "biceps",

  "triceps corda": "triceps",
  "triceps pulley": "triceps",
  "triceps testa": "triceps",
  "triceps frances": "triceps",
  "triceps maquina": "triceps",
  "mergulho paralelas": "triceps",

  "rosca de punho": "forearm",
  "rosca inversa": "forearm",
  "extensao de punho": "forearm",
  "farmer walk": "forearm",

  "agachamento livre": "legs",
  "agachamento smith": "legs",
  "agachamento frontal": "legs",
  "agachamento sumo": "legs",
  "agachamento bulgaro": "legs",
  "leg press": "legs",
  "leg press 45": "legs",
  "leg press pes altos": "legs",
  "leg press unilateral": "legs",
  "cadeira extensora": "legs",
  "extensao tradicional": "legs",
  afundo: "legs",

  "mesa flexora": "hamstrings",
  "cadeira flexora": "hamstrings",
  stiff: "hamstrings",
  "bom dia": "hamstrings",
  "hiperextensao lombar": "hamstrings",

  "cadeira abdutora": "glutes",
  "elevacao pelvica": "glutes",
  "elevação pélvica": "glutes",
  "hip thrust": "glutes",
  passada: "glutes",
  kickback: "glutes",

  "panturrilha em pe": "calves",
  "panturrilha no leg press": "calves",
  "panturrilha sentado": "calves",
  "panturrilha em pe unilateral": "calves",

  "prancha abdominal": "abs",
  "prancha isometrica": "abs",
  "prancha lateral": "abs",
  "abdominal maquina": "abs",
  "abdominal máquina": "abs",
  "crunch solo": "abs",
  "crunch no solo": "abs",
  "elevacao de perna": "abs",
  "elevação de perna": "abs",
  "russian twist": "abs",
  "bicicleta no solo": "abs",
  "mountain climber": "abs",

  esteira: "cardio",
  corrida: "cardio",
  bicicleta: "cardio",
  bike: "cardio",
  remador: "cardio",
  eliptico: "cardio",
  burpee: "cardio",
  "pular corda": "cardio",
  "swing de kettlebell": "cardio",
  "box jump": "cardio",
  "sprint na esteira": "cardio",
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

const FALLBACK_POOL: FitnessGlyph[] = [
  "chest", "back", "shoulder", "biceps", "triceps", "forearm",
  "legs", "hamstrings", "glutes", "calves", "abs", "cardio",
  "dumbbell", "barbell", "machine", "cable", "bodyweight",
];

export function fitnessForName(name: string, used?: Set<FitnessGlyph>): FitnessGlyph {
  const n = normalize(name);
  let glyph = EXERCISE_MAP[n];

  if (!glyph) {
    if (/supino|crucifixo|voador|peck|fundos|flexao/.test(n)) glyph = "chest";
    else if (/puxada|pulldown|remada|barra fixa|dorsal|shruug/.test(n)) glyph = "back";
    else if (/desenvolvimento|elevacao|ombro/.test(n)) glyph = "shoulder";
    else if (/rosca|biceps/.test(n)) glyph = "biceps";
    else if (/triceps|mergulho/.test(n)) glyph = "triceps";
    else if (/punho|antebraco|farmer/.test(n)) glyph = "forearm";
    else if (/agachamento|leg press|extensora|cadeira extensora|afundo/.test(n)) glyph = "legs";
    else if (/flexora|mesa flexora|stiff|bom dia|hiperextensao/.test(n)) glyph = "hamstrings";
    else if (/abdutora|pelvica|hip thrust|gluteo|sumo|passada|kickback/.test(n)) glyph = "glutes";
    else if (/panturrilha/.test(n)) glyph = "calves";
    else if (/prancha|abdominal|crunch|elevacao de perna|russian|bicicleta|mountain/.test(n)) glyph = "abs";
    else if (/esteira|corrida|bike|bicicleta|remador|eliptico|burpee|corda|kettlebell|box jump|sprint/.test(n)) glyph = "cardio";
    else if (/halter/.test(n)) glyph = "dumbbell";
    else if (/barra/.test(n)) glyph = "barbell";
    else if (/cabo|polia/.test(n)) glyph = "cable";
    else if (/maquina/.test(n)) glyph = "machine";
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

/** Avatar circular colorido por grupo muscular. */
export function FitnessIcon({
  glyph,
  size = 40,
  className = "",
  showIcon = true,
}: {
  glyph: FitnessGlyph;
  size?: number;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = GROUP_META[glyph] ?? GROUP_META.dumbbell;
  const Icon = meta.icon;
  const iconSize = Math.round(size * 0.32);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-display font-black", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: Math.round(size * 0.42),
        boxShadow: `inset 0 0 0 1.5px ${meta.color}25`,
      }}
      aria-label={meta.label}
      title={meta.label}
    >
      {showIcon ? <Icon size={iconSize} strokeWidth={2.2} /> : meta.initial}
    </span>
  );
}

/** Chip pequeno com a cor do grupo. */
export function GroupDot({ glyph, className }: { glyph: FitnessGlyph; className?: string }) {
  const meta = GROUP_META[glyph] ?? GROUP_META.dumbbell;
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", className)}
      style={{ backgroundColor: meta.color }}
      aria-hidden
    />
  );
}
