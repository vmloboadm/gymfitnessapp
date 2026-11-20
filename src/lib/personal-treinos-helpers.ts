import type { WorkoutPlan } from "~/lib/ai/local-gen";
import type { WorkoutTemplate } from "~/lib/personal-data";

/**
 * Auxiliares puros da tela de treinos do personal (formatação, normalização e
 * opções fixas). Saíram de src/app/(personal)/personal/treinos/page.tsx sem mudança.
 */

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Busca sem acento nem maiúscula ("biceps" acha "Bíceps", "marilia" acha "Marília"). */
export const normBusca = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();

/* ------------------------------------------------------------------ */
/* Assistente guiado: a IA faz perguntas (nível, objetivo, foco,        */
/* restrições) antes de gerar, em vez de uma frase livre.              */
/* ------------------------------------------------------------------ */

export const NIVEL_OPTS = ["Iniciante", "Intermediário", "Avançado"];
export const OBJETIVO_OPTS = ["Hipertrofia", "Emagrecimento", "Força", "Condicionamento"];

export type FocoOption = { id: string; label: string; sub: string; focus: string[] };

export const FOCO_OPTS: FocoOption[] = [
  { id: "full", label: "Corpo inteiro", sub: "todos os grupos em cada dia", focus: ["Corpo inteiro"] },
  { id: "ul", label: "Superiores e inferiores", sub: "Upper / Lower alternado", focus: ["Peito", "Costas", "Ombro", "Inferiores", "Glúteo"] },
  { id: "ppl", label: "Empurrar / Puxar / Pernas", sub: "divisão clássica", focus: ["Empurrar", "Puxar", "Pernas"] },
  { id: "lower", label: "Pernas e glúteos", sub: "ênfase em membros inferiores", focus: ["Inferiores", "Posterior", "Glúteo"] },
  { id: "upper", label: "Superior completo", sub: "peito, costas, ombro e braço", focus: ["Peito", "Costas", "Ombro", "Bíceps", "Tríceps"] },
  { id: "arms", label: "Braços", sub: "bíceps e tríceps como prioridade", focus: ["Bíceps", "Tríceps"] },
];

export type RestricaoOption = { label: string; sub: string; value: string | null };

/** Divisão por slots (rotação A, B, C... sem dia fixo): o personal escolhe. */
export const SPLIT_OPTS = [
  { id: "AB", label: "AB", sub: "2 treinos em rotação" },
  { id: "ABC", label: "ABC", sub: "3 treinos em rotação" },
  { id: "ABCD", label: "ABCD", sub: "4 treinos em rotação" },
  { id: "ABCDE", label: "ABCDE", sub: "5 treinos em rotação" },
  { id: "ABCDEF", label: "ABCDEF", sub: "6 treinos em rotação" },
] as const;

export const RESTRICAO_OPTS: RestricaoOption[] = [
  { label: "Nenhuma", sub: "pode tudo", value: null },
  { label: "Ombro", sub: "problema ou lesão", value: "Cuidado com ombro" },
  { label: "Joelho", sub: "problema ou lesão", value: "Cuidado com joelho" },
  { label: "Lombar", sub: "problema ou lesão", value: "Cuidado com lombar" },
  { label: "Sem impacto", sub: "articulações sensíveis", value: "Sem impacto articular" },
];

/** Normaliza o nível salvo no perfil para uma das opções do assistente. */
/**
 * Descanso em texto livre → "Ns". O banco só guarda dígitos: sem isto,
 * "1min" virava 1 segundo e "60-90s" virava 6090 segundos.
 */
export function normalizeRest(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase().replace(",", ".").trim();
  if (!s) return "60s";
  const mmss = s.match(/^(\d+):(\d{1,2})$/); // 1:30
  if (mmss) return `${Number(mmss[1]) * 60 + Number(mmss[2])}s`;
  const minSec = s.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutos?|')\s*(\d+)?\s*(?:s|seg)?/); // 1min, 1m30, 1.5 min
  if (minSec) return `${Math.round(Number(minSec[1]) * 60) + Number(minSec[2] ?? 0)}s`;
  const first = s.match(/\d+(?:\.\d+)?/); // 60-90s → 60
  if (!first) return "60s";
  return `${Math.min(600, Math.max(0, Math.round(Number(first[0]))))}s`;
}

export function normNivel(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/iniciante|come[çc]ando|leve/.test(v)) return "Iniciante";
  if (/avan[çc]ado|atleta|experiente/.test(v)) return "Avançado";
  if (/intermedi/.test(v)) return "Intermediário";
  return null;
}

/** Normaliza o objetivo salvo no perfil para uma das opções do assistente. */
export function normObjetivo(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/massa|hipertrof|musc|ganho|volume/.test(v)) return "Hipertrofia";
  if (/emagrec|perd|defin|seca|cutting/.test(v)) return "Emagrecimento";
  if (/for[çc]a/.test(v)) return "Força";
  if (/condic|resist|cardio|saude|saúde/.test(v)) return "Condicionamento";
  return null;
}

/** Converte um template simples no formato de plano (1 dia). */
export function templateToPlan(t: WorkoutTemplate): WorkoutPlan {
  return {
    nome: t.name,
    frequencia: `${t.days}x semana`,
    nivel: t.level,
    objetivo: "Hipertrofia",
    observacao_geral: t.description,
    dias: [
      {
        nome: "A · Principal",
        foco: t.name,
        aquecimento: ["5 min de esteira em ritmo leve", "Mobilidade articular, 3 min"],
        exercicios: t.exercises.map((e) => ({
          exercicio: e.name,
          series: e.sets,
          reps: e.reps,
          descanso: e.rest,
          rpe: t.level === "Iniciante" ? 6 : 8,
          dica: "Execução controlada, sem roubar a fase excêntrica.",
        })),
        finalizador: "Prancha 3x30s, descanso 20s",
      },
    ],
    cardio: "10 a 15 min de cardio leve ao final de 2 treinos.",
  };
}

/**
 * Montar Treino Automático: seleção de aluno, pedido em linguagem natural
 * com contexto completo, plano multi-dias gerado pelo modelo real
 * (via /api/assistente; sem modelo, o gerador local do app assume) e
 * revisão editável com drag antes de atribuir.
 */
