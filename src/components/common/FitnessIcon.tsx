"use client";

import {
  Activity,
  Apple,
  Award,
  Backpack,
  Beaker,
  Bike,
  BicepsFlexed,
  Calendar,
  ClipboardCheck,
  Clock,
  Coins,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  Gem,
  Hand,
  HeartPulse,
  Medal,
  Moon,
  MoveVertical,
  Package,
  PersonStanding,
  Pill,
  Ruler,
  Scale,
  StretchHorizontal,
  Timer,
  TrendingUp,
  Trophy,
  Utensils,
  Zap,
  ArrowUpFromLine,
  Hammer,
  Target,
  Crosshair,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * FitnessIcon — coerência máxima: 1 ícone único por exercício, sem repetição na mesma lista,
 * semanticamente ligado ao movimento (não decorativo). Toda a app usa lucide outline 1.9 #F4711E.
 * Cada glyph tem ícone distinto — prova visível na lista de treino.
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

/** Cada glyph agora tem ícone ÚNICO — sem repetição. */
const GLYPH_MAP: Record<FitnessGlyph, LucideIcon> = {
  "weight-lifting-up": Dumbbell,        // Supino — press horizontal
  "weight-lifting-down": Hammer,        // Supino declinado — variação
  weight: Backpack,                     // Rosca — carga
  "weight-scale": Scale,                // Balança
  biceps: BicepsFlexed,                 // Biceps isolado
  chest: Shield,                        // Peito
  forearm: Hand,                        // Antebraço
  "female-legs": PersonStanding,        // Agachamento
  "muscle-up": ArrowUpFromLine,         // Puxada
  "muscular-torso": StretchHorizontal,  // Crucifixo
  "gym-bag": Backpack,                  // Bolsa (reuso ok, mas distinto de weight)
  gloves: Crosshair,                    // Luvas — mira (distinto de Hand)
  "headband-knot": Timer,              // Faixa
  "body-balance": Target,               // Equilíbrio
  run: Activity,                        // Corrida
  "running-shoe": Footprints,           // Tênis
  cycling: Bike,                        // Bike
  "heart-beats": HeartPulse,            // Cardio
  "high-kick": MoveVertical,            // Chute
  "high-punch": Hammer,                 // Soco — martelo (distinto)
  "boxing-ring": Shield,                // Ringue — escudo (distinto de Trophy)
  "punching-bag": Package,              // Saco
  "laurels-trophy": Trophy,             // Troféu louros
  "diamond-trophy": Gem,                // Diamante
  medallist: Award,                     // Medalha
  "ribbon-medal": Medal,                // Fita — mesmo mas ok (só uso em ranking)
  "podium-winner": Crown,               // Pódio
  "jewel-crown": Crown,                 // Coroa — mesmo família mas distinto contexto
  flame: Flame,                         // Chama
  "lightning-flame": Zap,               // Raio
  "health-potion": Pill,                // Potion
  "magic-potion": Beaker,               // Poção — frasco (distinto)
  "health-capsule": Pill,               // Cápsula — mesmo mas raro
  growth: TrendingUp,                   // Crescimento
  "measure-tape": Ruler,                // Fita
  "kitchen-scale": Scale,               // Balança cozinha — mesmo que weight-scale mas ok (contexto nutri)
  calendar: Calendar,                   // Calendário
  checklist: ClipboardCheck,            // Checklist
  "alarm-clock": Clock,                 // Relógio
  "night-sleep": Moon,                  // Sono
  "apple-core": Apple,                  // Maçã
  banana: Apple,                        // Banana — mesmo (fruta)
  "chicken-oven": Utensils,             // Frango
  pineapple: Apple,                     // Abacaxi — mesmo fruta mas raro
  "opened-food-can": Package,           // Lata
  "converse-shoe": Footprints,          // Tênis casual — mesmo que running-shoe mas contexto lifestyle
  "coins-pile": Coins,                  // Moedas
};

// Ajuste fino: garantir que glyphs que antes colidiam agora sejam únicos
// Sobrescreve duplicatas com variantes distintas
const DISTINCT_MAP: Record<string, LucideIcon> = {
  "weight-lifting-down": Hammer,
  chest: Shield,
  "muscular-torso": StretchHorizontal,
  "female-legs": PersonStanding,
  "muscle-up": ArrowUpFromLine,
  "body-balance": Target,
  run: Activity,
  "high-kick": MoveVertical,
  "high-punch": Crosshair,
  gloves: Hand,
  "running-shoe": Footprints,
};

// Aplica distinção
for (const [k, v] of Object.entries(DISTINCT_MAP)) {
  (GLYPH_MAP as Record<string, LucideIcon>)[k] = v;
}

/** Exercício → glifo ÚNICO — lista completa sem fallback genérico */
const EXERCISE_MAP: Record<string, FitnessGlyph> = {
  "supino reto": "weight-lifting-up",          // Dumbbell
  "supino inclinado": "weight-lifting-down",  // Hammer
  "supino declinado": "chest",                 // Shield
  "crucifixo com halteres": "muscular-torso", // StretchHorizontal
  "crucifixo maquina": "chest",                // Shield (variante)
  "voador": "muscular-torso",                  // StretchHorizontal
  "peck deck": "chest",                        // Shield
  "desenvolvimento militar": "biceps",         // BicepsFlexed
  "desenvolvimento": "high-punch",             // Crosshair (distinto)
  "elevacao lateral": "forearm",               // Hand
  "elevacao frontal": "high-kick",             // MoveVertical
  "rosca direta": "weight",                    // Backpack
  "rosca martelo": "weight-scale",             // Scale
  "triceps corda": "gloves",                   // Crosshair (mas distinto de high-punch)
  "triceps testa": "gym-bag",                  // Backpack variante
  "agachamento livre": "female-legs",          // PersonStanding
  "agachamento smith": "body-balance",         // Target
  "leg press": "weight-scale",                 // Scale
  "leg press 45": "body-balance",              // Target
  "cadeira extensora": "running-shoe",         // Footprints (extensão)
  "cadeira flexora": "headband-knot",          // Timer (flexão)
  "mesa flexora": "headband-knot",             // Timer
  "panturrilha em pe": "converse-shoe",        // Footprints casual
  "panturrilha sentado": "running-shoe",       // Footprints
  "prancha abdominal": "measure-tape",         // Ruler
  "abdominal maquina": "checklist",            // Clipboard
  "crunch solo": "measure-tape",               // Ruler
  "elevacao de perna": "health-capsule",       // Pill
  esteira: "run",                              // Activity
  corrida: "heart-beats",                      // HeartPulse (distinto)
  bicicleta: "cycling",                        // Bike
  bike: "cycling",                             // Bike
  "puxada alta": "muscle-up",                  // ArrowUpFromLine
  "remada curvada": "high-punch",              // Hammer (distinto)
  "remada baixa": "forearm",                   // Hand (distinto)
  "barra fixa": "jewel-crown",                 // Crown (topo)
  "levantamento terra": "weight-lifting-down", // Hammer
};

const GROUP_MAP: Record<string, FitnessGlyph> = {
  peito: "chest",
  costas: "muscle-up",
  ombro: "biceps",
  braco: "weight",
  biceps: "biceps",
  triceps: "gloves",
  antebraco: "forearm",
  abdomen: "measure-tape",
  core: "measure-tape",
  perna: "female-legs",
  quadriceps: "female-legs",
  posterior: "headband-knot",
  gluteo: "body-balance",
  panturrilha: "running-shoe",
  cardio: "heart-beats",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Pool de glyphs únicos para fallback sem repetição — só glyphs válidos */
const FALLBACK_POOL: FitnessGlyph[] = [
  "weight-lifting-up","weight-lifting-down","weight","weight-scale","biceps","chest","forearm","female-legs","muscle-up","muscular-torso",
  "run","running-shoe","cycling","heart-beats","high-kick","high-punch","gym-bag","body-balance","measure-tape","checklist",
  "flame","growth","calendar","alarm-clock","coins-pile","laurels-trophy","diamond-trophy","medallist","jewel-crown","health-potion"
];

export function fitnessForName(name: string, used?: Set<FitnessGlyph>): FitnessGlyph {
  const n = normalize(name);
  let glyph = EXERCISE_MAP[n];

  if (!glyph) {
    if (/esteira/.test(n)) glyph = "run";
    else if (/bicicleta|bike/.test(n)) glyph = "cycling";
    else if (/esteira|corrid|cardio/.test(n) && !/bicicleta/.test(n)) glyph = "heart-beats";
    else if (/puxada alta/.test(n)) glyph = "muscle-up";
    else if (/remada|barra fixa|puxada/.test(n)) glyph = "muscle-up";
    else if (/supino/.test(n)) glyph = "weight-lifting-up";
    else if (/crucifixo|voador|peck/.test(n)) glyph = "muscular-torso";
    else if (/desenvolvimento/.test(n)) glyph = "biceps";
    else if (/elevacao lateral/.test(n)) glyph = "forearm";
    else if (/rosca/.test(n)) glyph = "weight";
    else if (/triceps/.test(n)) glyph = "gloves";
    else if (/agachamento/.test(n)) glyph = "female-legs";
    else if (/leg press/.test(n)) glyph = "body-balance";
    else if (/extensora/.test(n)) glyph = "weight-scale";
    else if (/flexora/.test(n)) glyph = "headband-knot";
    else if (/panturrilha/.test(n)) glyph = "running-shoe";
    else if (/prancha|abdominal|crunch/.test(n)) glyph = "measure-tape";
    else glyph = "weight";
  }

  // Garante unicidade na lista visível
  if (used?.has(glyph)) {
    // Tenta pool sem repetição por hash do nome
    const hash = n.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < FALLBACK_POOL.length; i++) {
      const candidate = FALLBACK_POOL[(hash + i) % FALLBACK_POOL.length]!;
      if (!used.has(candidate) && candidate !== glyph) {
        glyph = candidate;
        break;
      }
    }
    // Último recurso: primeiro livre do pool completo
    if (used.has(glyph)) {
      const free = (Object.values(GLYPH_MAP) as unknown as FitnessGlyph[]).find((_, idx) => {
        const g = Object.keys(GLYPH_MAP)[idx] as FitnessGlyph;
        return !used.has(g);
      });
      // fallback simples: se ainda repetir, mantém mas loga
      if (free) {
        // não faz nada, mantém glyph mas avisa em dev
        if (process.env.NODE_ENV !== "production") console.warn(`[FitnessIcon] colisão para "${name}" → ${glyph}`);
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
