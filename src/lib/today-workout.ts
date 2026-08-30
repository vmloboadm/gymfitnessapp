import { nextWorkoutFromLogs } from "~/components/dashboard/mocks";
import { demoTreinoData } from "~/lib/demo-bridge";
import type { WorkoutLogs } from "~/lib/types/models";

/**
 * FONTE ÚNICA do "Treino de Hoje".
 * Dashboard e aba Treino leem O MESMO objeto daqui, nunca dois mocks
 * separados. Em demo é um singleton em memória; com dados reais, ambas as
 * telas passam os MESMOS logs (mesma query do aluno) por resolve().
 */
export type TodayWorkout = {
  /** String exibida nos dois lugares, ex: "Treino do dia · Peito & Tríceps" */
  label: string;
  focusLabel: string;
  resume: boolean;
  bodyCat: string;
  logs: WorkoutLogs[];
  /** Última vez que cada grupo foi treinado (catId → ISO). Fonte: mesmos logs do NFC/treinos. */
  lastTrained: Record<string, string | null>;
};

/* exercício demo → grupo muscular do mapa corporal */
const DEMO_EX_GROUP: Record<string, string> = {
  "ex-demo-001": "peito",
  "ex-demo-002": "perna",
  "ex-demo-005": "costas",
  "ex-demo-006": "perna",
};

/** Grupos grandes descansam 48h; pequenos, 24h. Regra simples e útil pro dia 1. */
export const RECOVERY_HOURS: Record<string, number> = {
  peito: 48,
  costas: 48,
  perna: 48,
  ombro: 24,
  braco: 24,
  abdomen: 24,
  panturrilha: 24,
};

/**
 * Escala de recuperação em 4 estados (cor-com-função no mapa corporal).
 * Grupo grande (peito/costas/perna) precisa de mais tempo que o pequeno:
 *   descansado  ≥72h (ou nunca treinado)   ≥48h (ou nunca)
 *   recuperando 48–72h                      24–48h
 *   cansado     24–48h                      12–24h
 *   exausto     <24h                        <12h
 */
export type RecoveryState = "descansado" | "recuperando" | "cansado" | "exausto";

const LARGE_GROUPS = new Set(["peito", "costas", "perna"]);

export function recoveryState(catId: string, lastISO: string | null | undefined): RecoveryState {
  if (!lastISO) return "descansado"; // nunca treinado = descansado
  const h = (Date.now() - new Date(lastISO).getTime()) / 3600000;
  if (LARGE_GROUPS.has(catId)) {
    if (h >= 72) return "descansado";
    if (h >= 48) return "recuperando";
    if (h >= 24) return "cansado";
    return "exausto";
  }
  if (h >= 48) return "descansado";
  if (h >= 24) return "recuperando";
  if (h >= 12) return "cansado";
  return "exausto";
}


function build(logs: WorkoutLogs[], categoryOf?: (exerciseId: string) => string | null): TodayWorkout {
  const focus = nextWorkoutFromLogs(logs);

  // última vez que cada grupo foi treinado (fonte: os próprios logs)
  const lastTrained: Record<string, string | null> = {};
  const catOf = categoryOf ?? ((exId: string) => DEMO_EX_GROUP[exId] ?? null);
  for (const l of logs as Array<WorkoutLogs & { exercise_id?: string }>) {
    const cat = catOf(l.exercise_id ?? "");
    if (!cat) continue;
    if (!lastTrained[cat] || l.date > lastTrained[cat]) lastTrained[cat] = l.date;
  }

  return {
    label: `Treino do dia · ${focus.label}`,
    focusLabel: focus.label,
    resume: focus.resume,
    bodyCat: focus.bodyCat,
    logs,
    lastTrained,
  };
}

let demoSingleton: TodayWorkout | null = null;

/** Demo: sempre o MESMO objeto (logs idênticos nas duas telas). */
export function getTodayWorkout(): TodayWorkout {
  if (!demoSingleton) {
    demoSingleton = build(demoTreinoData().logs as WorkoutLogs[]);
  }
  return demoSingleton;
}

/** Dados reais: passe os MESMOS logs em ambas as telas. */
export function resolveTodayWorkout(logs: WorkoutLogs[]): TodayWorkout {
  return build(logs);
}
