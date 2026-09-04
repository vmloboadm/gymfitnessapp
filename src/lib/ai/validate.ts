/**
 * Validação runtime do JSON retornado pela IA.
 * Garante que o plano de treino tem a estrutura correta antes de salvar.
 */

import { z } from "zod";

export const PlanExerciseSchema = z.object({
  exercicio: z.string().min(1, "Exercício obrigatório"),
  series: z.number().int().min(1).max(20),
  reps: z.string().min(1),
  descanso: z.string(),
  rpe: z.number().int().min(1).max(10),
  dica: z.string().optional().default(""),
});

export const PlanDaySchema = z.object({
  nome: z.string().min(1),
  foco: z.string().min(1),
  aquecimento: z.array(z.string()).optional().default([]),
  exercicios: z.array(PlanExerciseSchema).min(1, "Dia precisa de pelo menos 1 exercício"),
  finalizador: z.string().optional().default(""),
});

export const WorkoutPlanSchema = z.object({
  nome: z.string().min(1, "Nome do plano obrigatório"),
  frequencia: z.string().min(1),
  daysSelected: z.array(z.string()).optional(),
  nivel: z.string().min(1),
  objetivo: z.string().min(1),
  observacao_geral: z.string().optional().default(""),
  dias: z.array(PlanDaySchema).min(1, "Plano precisa de pelo menos 1 dia"),
  cardio: z.string().optional().default(""),
});

export type ValidatedWorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

/**
 * Valida dados brutos da IA e retorna o plano validado.
 * Se inválido, retorna erro descritivo.
 */
export function validateWorkoutPlan(raw: unknown): {
  ok: true;
  plan: ValidatedWorkoutPlan;
} | {
  ok: false;
  error: string;
  details: string[];
} {
  const result = WorkoutPlanSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, plan: result.data };
  }
  return {
    ok: false,
    error: "Plano de treino com dados inválidos",
    details: result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    ),
  };
}

/**
 * Tenta extrair JSON de um texto que pode ter lixo ao redor.
 *Útil quando a IA retorna texto antes/depois do JSON.
 */
export function extractJson(text: string): unknown | null {
  // Tenta parse direto
  try {
    return JSON.parse(text);
  } catch {
    // ignora
  }

  // Tenta extrair de bloco de código
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // ignora
    }
  }

  // Tenta encontrar o primeiro { ... } balanceado
  const braceStart = text.indexOf("{");
  if (braceStart !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = braceStart; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(braceStart, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
}
