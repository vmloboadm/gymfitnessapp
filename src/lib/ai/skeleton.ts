/**
 * Esqueleto de treino: monta só a ESTRUTURA de cada dia da divisão
 * (quais grupos musculares e quantos exercícios em cada) a partir das
 * respostas do assistente guiado (nível, objetivo, foco, divisão).
 *
 * O personal escolhe os exercícios reais depois, por categoria, no
 * picker de múltipla escolha. Nada de IA: é determinístico e instantâneo.
 */

export type SkeletonTarget = { categoria: string; qtd: number };

export type SkeletonDay = {
  slot: string;
  nome: string;
  foco: string;
  aquecimento: string[];
  finalizador: string;
  alvo: SkeletonTarget[];
};

type DayType = "Full Body" | "Superiores" | "Inferiores" | "Empurrar" | "Puxar" | "Pernas" | "Braços";

/** Categorias (ids do banco) que entram em cada tipo de dia, em ordem de prioridade. */
const DAYTYPE_CATS: Record<DayType, string[]> = {
  Empurrar: ["peito", "ombro", "triceps"],
  Puxar: ["costas", "biceps"],
  Pernas: ["perna", "gluteo", "panturrilha", "core"],
  Superiores: ["peito", "costas", "ombro", "biceps", "triceps"],
  Inferiores: ["perna", "gluteo", "panturrilha", "core"],
  Braços: ["biceps", "triceps"],
  "Full Body": ["peito", "costas", "perna", "gluteo", "ombro", "core"],
};

const DAYTYPE_FOCO: Record<DayType, string> = {
  "Full Body": "Corpo inteiro",
  Superiores: "Peito, costas, ombro e braços",
  Inferiores: "Pernas, glúteos, panturrilha e core",
  Empurrar: "Peito, ombro e tríceps",
  Puxar: "Costas e bíceps",
  Pernas: "Pernas, glúteos, panturrilha e core",
  Braços: "Bíceps e tríceps",
};

const CAT_LABEL: Record<string, string> = {
  peito: "Peito",
  costas: "Costas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  perna: "Pernas",
  gluteo: "Glúteos",
  panturrilha: "Panturrilha",
  core: "Core",
  cardio: "Cardio",
};

const WARMUPS = {
  superior: ["Mobilidade de ombro com bastão, 2x10", "Rotação externa leve com elástico, 2x12"],
  inferior: ["Agachamento livre sem carga, 2x10", "Mobilidade de tornozelo na parede, 2x10"],
  gluteo: ["Ponte de glúteo sem carga, 2x15", "Mobilidade de quadril 90/90, 2 min"],
  geral: ["5 min de esteira em ritmo leve", "Mobilidade de quadril e ombro, 3 min"],
};

/** Quantos exercícios por dia conforme o nível (guia para o personal). */
function targetTotal(level: string): number {
  const l = (level ?? "").toLowerCase();
  if (/iniciante|come[çc]/.test(l)) return 4;
  if (/avan[çc]/.test(l)) return 6;
  return 5;
}

/** Sequência de tipos de dia a partir da divisão + foco (espelha o gerador real). */
function dayTypesFor(numDays: number, level: string, o: {
  lowerFocus: boolean;
  gluteFocus: boolean;
  upperFocus: boolean;
  armsFocus: boolean;
  pplFocus: boolean;
}): DayType[] {
  const n = numDays;
  if (o.lowerFocus || o.gluteFocus) {
    if (n <= 2) return ["Inferiores", "Superiores"];
    if (n === 3) return ["Inferiores", "Superiores", "Inferiores"];
    return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "Inferiores" : "Superiores") as DayType);
  }
  if (o.armsFocus) {
    const seq: DayType[] = ["Braços", "Empurrar", "Puxar", "Inferiores"];
    return Array.from({ length: n }, (_, i) => seq[i % seq.length]);
  }
  if (o.upperFocus) {
    if (n === 2) return ["Superiores", "Inferiores"];
    if (n === 3) return ["Empurrar", "Puxar", "Pernas"];
    const seq: DayType[] = ["Superiores", "Inferiores", "Empurrar", "Puxar", "Pernas"];
    return Array.from({ length: n }, (_, i) => seq[i % seq.length]);
  }
  if (o.pplFocus) {
    const seq: DayType[] = ["Empurrar", "Puxar", "Pernas"];
    return Array.from({ length: n }, (_, i) => seq[i % seq.length]);
  }
  if (n === 1) return ["Full Body"];
  if (n === 2) return ["Full Body", "Full Body"];
  if (n === 3) return level === "Iniciante" ? ["Full Body", "Full Body", "Full Body"] : ["Empurrar", "Puxar", "Pernas"];
  if (n === 4) return ["Superiores", "Inferiores", "Superiores", "Inferiores"];
  if (n === 5) return ["Superiores", "Inferiores", "Empurrar", "Puxar", "Pernas"];
  const seq: DayType[] = ["Empurrar", "Puxar", "Pernas"];
  return Array.from({ length: n }, (_, i) => seq[i % seq.length]);
}

/** Distribui o total de exercícios entre as categorias do dia (peso nas primeiras). */
function distribute(cats: string[], total: number): SkeletonTarget[] {
  const base = Math.floor(total / cats.length);
  const rem = total - base * cats.length;
  return cats
    .map((categoria, i) => ({ categoria, qtd: base + (i < rem ? 1 : 0) }))
    .filter((x) => x.qtd > 0);
}

/**
 * Constrói o esqueleto do plano. Não escolhe exercícios: só a estrutura
 * de cada dia (grupos + quantidade) para o personal preencher.
 */
export function buildSkeleton(opts: {
  split: string;
  level: string;
  objetivo: string;
  focoIds: string[];
  studentName: string;
}): SkeletonDay[] {
  const { split, level, objetivo, focoIds } = opts;
  const n = Math.max(1, split.length);
  const lowerFocus = focoIds.includes("lower");
  const gluteFocus = focoIds.includes("lower");
  const upperFocus = focoIds.includes("upper") || focoIds.includes("ul");
  const armsFocus = focoIds.includes("arms");
  const pplFocus = focoIds.includes("ppl");
  const types = dayTypesFor(n, level, { lowerFocus, gluteFocus, upperFocus, armsFocus, pplFocus });
  const total = targetTotal(level);
  const letters = split.split("");
  const addCardio = /emagrec|condic/i.test(objetivo);

  return letters.map((L, i) => {
    const type = types[i] ?? "Full Body";
    let cats = [...DAYTYPE_CATS[type]];
    // foco em glúteo: garante peso extra nesse grupo nos dias de perna
    if (gluteFocus && cats.includes("gluteo") && !cats.slice(0, 2).includes("gluteo")) {
      cats = ["gluteo", ...cats.filter((c) => c !== "gluteo")];
    }
    const alvo = distribute(cats, total);
    if (addCardio && !alvo.some((a) => a.categoria === "cardio")) {
      alvo.push({ categoria: "cardio", qtd: 1 });
    }
    const warmKey = gluteFocus && (type === "Inferiores" || type === "Pernas")
      ? "gluteo"
      : type === "Full Body"
        ? "geral"
        : type === "Inferiores" || type === "Pernas"
          ? "inferior"
          : "superior";
    const focoTxt = alvo.map((a) => CAT_LABEL[a.categoria] ?? a.categoria).join(", ");
    return {
      slot: L,
      nome: `${L} · ${DAYTYPE_FOCO[type]}`,
      foco: focoTxt,
      aquecimento: WARMUPS[warmKey],
      finalizador: "",
      alvo,
    };
  });
}

/** Prescrição padrão (séries/reps/descanso/RPE) por objetivo e nível. */
export function defaultPrescription(level: string, objetivo: string): {
  series: number;
  reps: string;
  descanso: string;
  rpe: number;
} {
  const l = (level ?? "").toLowerCase();
  const iniciante = /iniciante|come[çc]/.test(l);
  const o = (objetivo ?? "").toLowerCase();
  if (/for[çc]a/.test(o)) {
    return { series: iniciante ? 3 : 4, reps: "4-6", descanso: "120s", rpe: 8 };
  }
  if (/emagrec|condic/.test(o)) {
    return { series: 3, reps: "12-15", descanso: "45s", rpe: 6 };
  }
  // hipertrofia (padrão)
  return { series: iniciante ? 3 : 4, reps: "8-12", descanso: "60s", rpe: 7 };
}
