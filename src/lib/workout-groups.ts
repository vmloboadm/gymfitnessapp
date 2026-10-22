import type { PlanExercise } from "~/lib/ai/local-gen";

export type Tecnica = "normal" | "biset" | "triset" | "dropset";

export type ExerciseGroup<T> = {
  tecnica: Tecnica;
  /** Exercícios que formam o bloco (1 = normal; 2 = bi-set; 3 = tri-set). */
  items: Array<{ item: T; index: number }>;
};

const isConjugado = (t?: string | null): t is "biset" | "triset" =>
  t === "biset" || t === "triset";

/**
 * Agrupa exercícios conjugados para exibição.
 *
 * Aceita as duas formas de marcar no editor:
 *   - marcar só o primeiro do par  → [bi-set, normal]
 *   - marcar os dois do par        → [bi-set, bi-set]
 * Em ambos os casos o resultado é UM bloco com os dois exercícios.
 *
 *   bi-set  → 2 exercícios
 *   tri-set → 3 exercícios
 *   normal / drop-set → sozinho
 */
export function groupByTecnica<T extends { tecnica?: string | null }>(items: T[]): ExerciseGroup<T>[] {
  const groups: ExerciseGroup<T>[] = [];
  let i = 0;
  while (i < items.length) {
    const t = items[i]?.tecnica ?? "normal";
    if (isConjugado(t)) {
      const target = t === "biset" ? 2 : 3;
      let j = i;
      // 1) consome as marcações iguais consecutivas
      while (j < items.length && items[j]?.tecnica === t) j++;
      // 2) completa com os "normal" seguintes até fechar o bloco
      while (j - i < target && j < items.length && !isConjugado(items[j]?.tecnica)) j++;
      const group: ExerciseGroup<T> = { tecnica: t, items: [] };
      for (let k = i; k < j; k++) group.items.push({ item: items[k] as T, index: k });
      groups.push(group);
      i = j;
      continue;
    }
    groups.push({ tecnica: t === "dropset" ? "dropset" : "normal", items: [{ item: items[i] as T, index: i }] });
    i += 1;
  }
  return groups;
}

export function tecnicaLabel(t: Tecnica): string {
  switch (t) {
    case "biset":
      return "Bi-set";
    case "triset":
      return "Tri-set";
    case "dropset":
      return "Drop-set";
    default:
      return "Normal";
  }
}

/** "Sem descanso entre eles" — o recado que o aluno precisa entender. */
export function tecnicaHint(t: Tecnica): string | null {
  if (t === "biset") return "Sem descanso: faça um e vá direto no outro. Descanso só no fim do par.";
  if (t === "triset") return "Sem descanso: faça os três seguidos. Descanso só no fim do tri-set.";
  if (t === "dropset") return "Na última série, reduza a carga e continue sem descanso.";
  return null;
}

/** Utilidade de leitura para listas que vêm do banco (technique em inglês). */
export function normalizaTecnica(technique?: string | null): Tecnica {
  const t = (technique ?? "normal").toLowerCase();
  if (t === "biset" || t === "bi-set") return "biset";
  if (t === "triset" || t === "tri-set") return "triset";
  if (t === "dropset" || t === "drop-set") return "dropset";
  return "normal";
}

/**
 * Posição de um exercício dentro de um bloco conjugado (para o editor).
 * `start` = começa o bloco; `member` = continua o bloco anterior.
 */
export function tecnicaPosition<T extends { tecnica?: string | null }>(
  list: T[],
  i: number
): { role: "start" | "member" | null; size: number } {
  const groups = groupByTecnica(list);
  for (const g of groups) {
    const posInGroup = g.items.findIndex((x) => x.index === i);
    if (posInGroup === -1) continue;
    if (g.items.length <= 1) return { role: null, size: 1 };
    return { role: posInGroup === 0 ? "start" : "member", size: g.items.length };
  }
  return { role: null, size: 1 };
}

export type { PlanExercise };
