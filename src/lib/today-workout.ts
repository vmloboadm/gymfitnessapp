import { nextWorkoutFromLogs } from "~/components/dashboard/mocks";
import type { WorkoutLogs } from "~/lib/types/models";

/**
 * FONTE ÚNICA do "Treino de Hoje".
 * Dashboard e aba Treino leem O MESMO objeto daqui — nunca dois mocks
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
};

const DAY_LABELS: Record<string, string> = {};

function build(logs: WorkoutLogs[]): TodayWorkout {
  const focus = nextWorkoutFromLogs(logs);
  return {
    label: `Treino do dia · ${focus.label}`,
    focusLabel: focus.label,
    resume: focus.resume,
    bodyCat: focus.bodyCat,
    logs,
  };
}

let demoSingleton: TodayWorkout | null = null;

/** Demo: sempre o MESMO objeto (logs idênticos nas duas telas). */
export function getTodayWorkout(): TodayWorkout {
  if (!demoSingleton) {
    // import tardio evita ciclo de módulo com demo-bridge
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { demoTreinoData } = require("~/lib/demo-bridge") as typeof import("~/lib/demo-bridge");
    demoSingleton = build(demoTreinoData().logs as WorkoutLogs[]);
  }
  return demoSingleton;
}

/** Dados reais: passe os MESMOS logs em ambas as telas. */
export function resolveTodayWorkout(logs: WorkoutLogs[]): TodayWorkout {
  return build(logs);
}
