/**
 * Motor local de IA (modo offline / demo sem chave OmniRoute).
 * Produz a MESMA saída JSON que os system prompts pedem aos modelos:
 * plano multi-dias completo com aquecimento, RPE, dicas, finalizador,
 * cardio semanal e progressão. Também gera briefing e insights.
 *
 * É determinístico e ancorado na biblioteca real de exercícios (demoLib),
 * então o produto funciona 100% sem chave e melhora sozinho quando a
 * chave do gateway é configurada (o Co-Pilot troca o motor pelo LLM).
 */

import { demoLib } from "~/lib/demo-bridge";

export type PlanExercise = {
  exercicio: string;
  series: number;
  reps: string;
  descanso: string;
  rpe: number;
  dica: string;
};

export type PlanDay = {
  nome: string;
  foco: string;
  aquecimento: string[];
  exercicios: PlanExercise[];
  finalizador: string;
};

export type WorkoutPlan = {
  nome: string;
  frequencia: string;
  /** Dias da semana escolhidos pelo aluno ("Seg", "Qua"...), na ordem semanal */
  daysSelected?: string[];
  nivel: string;
  objetivo: string;
  observacao_geral: string;
  dias: PlanDay[];
  cardio: string;
};

type LibEntry = { name: string; group: string; info: string };

const FLAT_LIB: LibEntry[] = demoLib.flatMap((c) =>
  c.subs.flatMap((sub) => sub.exercises.map((e) => ({
    name: e.name,
    group: c.name,
    info: e.info ?? "",
  })))
);

const WARMUPS: Record<string, string[]> = {
  superior: ["Mobilidade de ombro com bastão, 2x10", "Rotação externa leve com elástico, 2x12"],
  inferior: ["Agachamento livre sem carga, 2x10", "Mobilidade de tornozelo na parede, 2x10"],
  geral: ["5 min de esteira em ritmo leve", "Mobilidade de quadril e ombro, 3 min"],
  gluteo: ["Ponte de glúteo sem carga, 2x15", "Mobilidade de quadril 90/90, 2 min"],
};

const FINISHERS = [
  "Prancha 3x30s, descanso 20s",
  "Dead bug 3x10 por lado, ritmo controlado",
  "Abdominal na polia 3x12, sem puxar o pescoço",
  "Birddog 3x10 por lado, pausa de 2s",
];

function pickBy<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length];
}

/** Interpreta o pedido em linguagem natural. */
export function parseIntent(prompt: string): {
  focus: string[];
  freq: number;
  level: "Iniciante" | "Intermediário" | "Avançado";
  restrictions: string[];
  goal: string;
} {
  const p = prompt.toLowerCase();
  const focus: string[] = [];
  if (/gl[úu]teo|bumbum/.test(p)) focus.push("Glúteo");
  if (/perna|inferior|coxa|quadr[íi]ceps/.test(p)) focus.push("Inferiores");
  if (/peito|supino/.test(p)) focus.push("Peito");
  if (/costa|dorsal|puxad/.test(p)) focus.push("Costas");
  if (/ombro|deltoide/.test(p)) focus.push("Ombro");
  if (/bra[çc]o|b[íi]ceps|tr[íi]ceps/.test(p)) focus.push("Braço");
  if (/abd|core|barriga/.test(p)) focus.push("Abdômen / Core");
  if (/posterior|femoral/.test(p)) focus.push("Posterior");
  if (focus.length === 0) focus.push("Corpo inteiro");

  const freq = Number(p.match(/(\d)\s?x/)?.[1] ?? 3);
  const level: "Iniciante" | "Intermediário" | "Avançado" =
    /iniciante|come[çc]ando|primeira vez|leve/.test(p)
      ? "Iniciante"
      : /avan[çc]ado|atleta|experiente/.test(p)
        ? "Avançado"
        : "Intermediário";

  const restrictions: string[] = [];
  if (/sem impacto|baixo impacto|articula/.test(p)) restrictions.push("Sem impacto articular");
  if (/em casa|casa|viagem|sem aparelho/.test(p)) restrictions.push("Sem equipamentos");
  if (/joelho/.test(p)) restrictions.push("Cuidado com joelho");
  if (/lombar|coluna/.test(p)) restrictions.push("Cuidado com lombar");

  const goal = /hipertrofia|massa/.test(p)
    ? "Hipertrofia"
    : /emagrec|cutting|defini|perder/.test(p)
      ? "Emagrecimento"
      : /for[çc]a|força/.test(p)
        ? "Força"
        : /condicion|resist/.test(p)
          ? "Condicionamento"
          : "Hipertrofia";

  return { focus, freq: Math.min(6, Math.max(2, freq)), level, restrictions, goal };
}

function scoreExercise(e: LibEntry, focus: string[], restrictions: string[]): number {
  let s = 0;
  const text = (e.name + " " + e.group).toLowerCase();
  if (focus.includes("Glúteo") && /gl[úu]teo|quadril|pélvica|abdutor|stiff|coice|afundo/.test(text)) s += 4;
  if (focus.includes("Inferiores") && /inferior|perna|leg|agach|extensor|flexor|panturrilha/.test(text)) s += 3;
  if (focus.includes("Peito") && /peito|supino|crucifixo|voador|flexão|paralelas/.test(text)) s += 3;
  if (focus.includes("Costas") && /costa|puxada|remada|barra fixa|pulldown/.test(text)) s += 3;
  if (focus.includes("Ombro") && /ombro|desenvolv|eleva[çc][ãa]o lateral/.test(text)) s += 3;
  if (focus.includes("Braço") && /rosca|tr[íi]ceps|bíceps|francês|mergulho/.test(text)) s += 3;
  if (focus.includes("Abdômen / Core") && /abd|prancha|abdominal|prancha/.test(text)) s += 3;
  if (focus.includes("Posterior") && /stiff|femoral|mesa|posterior/.test(text)) s += 4;
  if (restrictions.includes("Sem impacto articular") && /polia|m[áa]quina|p[ée]lvica|abdutor|el[íi]ptico/.test(text)) s += 2;
  if (restrictions.includes("Sem impacto articular") && /salto|corrida|burpee/.test(text)) s -= 5;
  if (restrictions.includes("Cuidado com joelho") && /agachamento livre|salto/.test(text)) s -= 3;
  if (restrictions.includes("Sem equipamentos") && /peso corporal|solo|chão/.test(text)) s += 3;
  if (restrictions.includes("Sem equipamentos") && /polia|m[áa]quina|barra|halter/.test(text)) s -= 4;
  return s;
}

function prescriptionFor(level: string, goal: string): { sets: number; reps: string; rest: string; rpe: number } {
  if (level === "Iniciante") return { sets: 3, reps: goal === "Força" ? "8" : "12", rest: "60s", rpe: 6 };
  if (goal === "Força") return { sets: 4, reps: "5-6", rest: "120s", rpe: 8 };
  if (goal === "Emagrecimento") return { sets: 3, reps: "15", rest: "45s", rpe: 7 };
  return { sets: 4, reps: "8-10", rest: "90s", rpe: 8 };
}

function buildDay(
  label: string,
  foco: string,
  focus: string[],
  restrictions: string[],
  level: string,
  goal: string,
  seed: number,
  warmKey: "superior" | "inferior" | "geral" | "gluteo",
  pool: LibEntry[]
): PlanDay {
  const rx = prescriptionFor(level, goal);
  const scored = pool
    .map((e) => ({ e, s: scoreExercise(e, focus, restrictions) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const chosen: LibEntry[] = [];
  for (const { e } of scored) {
    if (chosen.length >= 6) break;
    if (!chosen.some((c) => c.name === e.name)) chosen.push(e);
  }
  // completa com compostos seguros se faltar
  const fillers = pool.filter((e) => !chosen.some((c) => c.name === e.name));
  while (chosen.length < 5 && fillers.length) {
    chosen.push(pickBy(fillers, seed + chosen.length));
  }

  return {
    nome: label,
    foco,
    aquecimento: WARMUPS[warmKey],
    exercicios: chosen.map((e, i) => ({
      exercicio: e.name,
      series: rx.sets,
      reps: rx.reps,
      descanso: rx.rest,
      rpe: Math.min(9, rx.rpe + (i < 2 ? 1 : 0)),
      dica: e.info ? e.info.split(".")[0] : "Execução controlada, sem roubar a fase excêntrica.",
    })),
    finalizador: pickBy(FINISHERS, seed),
  };
}

/** Gera o plano completo (multi-dias) a partir do pedido do personal. */
export function generatePlanOffline(prompt: string, studentName?: string): WorkoutPlan {
  const intent = parseIntent(prompt);
  const seed = prompt.length + prompt.charCodeAt(0);
  const days: PlanDay[] = [];
  const names = ["A", "B", "C", "D", "E", "F"];

  const isFocusPlan = !intent.focus.includes("Corpo inteiro");
  const lowerFocus = intent.focus.some((f) => ["Glúteo", "Inferiores", "Posterior"].includes(f));
  const upperFocus = intent.focus.some((f) => ["Peito", "Costas", "Ombro", "Braço"].includes(f));

  for (let d = 0; d < intent.freq; d++) {
    let warmKey: "superior" | "inferior" | "geral" | "gluteo" = "geral";
    if (intent.focus.includes("Glúteo")) warmKey = "gluteo";
    else if (lowerFocus) warmKey = "inferior";
    else if (upperFocus) warmKey = "superior";

    // alterna o ângulo do músculo foco entre dias (variação A/B)
    const dayFocus = isFocusPlan ? `${intent.focus.join(" + ")} · variação ${names[d]}` : "Corpo inteiro";
    const pool = FLAT_LIB.filter((e) => {
      if (!isFocusPlan) return true;
      const t = (e.name + " " + e.group).toLowerCase();
      return intent.focus.some((f) => {
        const key = f === "Inferiores" ? "inferior" : f.toLowerCase().slice(0, 5);
        return t.includes(key);
      });
    });

    days.push(
      buildDay(
        `${names[d]} · ${dayFocus.split(" · ")[0]}${isFocusPlan ? ` (${names[d]})` : ""}`,
        dayFocus,
        intent.focus,
        intent.restrictions,
        intent.level,
        intent.goal,
        seed + d * 13,
        warmKey,
        pool.length >= 8 ? pool : FLAT_LIB
      )
    );
  }

  const focusLabel = isFocusPlan ? intent.focus.join(" + ") : "Full Body";
  return {
    nome: `${focusLabel} · ${intent.level}`,
    frequencia: `${intent.freq}x semana`,
    nivel: intent.level,
    objetivo: intent.goal,
    observacao_geral:
      `Plano de ${intent.freq}x semana com foco em ${focusLabel.toLowerCase()} para ${studentName ?? "o aluno"}, ` +
      `nível ${intent.level.toLowerCase()}. Progressão: complete as reps no RPE alvo e some 2.5 kg nos superiores e 5 kg nos inferiores na semana seguinte.` +
      (intent.restrictions.length ? ` Restrições respeitadas: ${intent.restrictions.join(", ").toLowerCase()}.` : ""),
    dias: days,
    cardio:
      intent.goal === "Emagrecimento"
        ? "25 min de esteira ou elíptico em ritmo moderado após 3 treinos da semana."
        : "10 a 15 min de cardio leve ao final de 2 treinos, sem prejudicar a recuperação.",
  };
}

/** Parsing do JSON que vier do LLM com fallback pro motor local. */
export function parsePlanFromLLM(text: string, fallback: WorkoutPlan): WorkoutPlan {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const raw = JSON.parse(match[0]) as Partial<WorkoutPlan> & { exercicios?: PlanExercise[] };
    if (Array.isArray(raw.dias) && raw.dias.length > 0) {
      return {
        nome: raw.nome ?? fallback.nome,
        frequencia: raw.frequencia ?? fallback.frequencia,
        nivel: raw.nivel ?? fallback.nivel,
        objetivo: raw.objetivo ?? fallback.objetivo,
        observacao_geral: raw.observacao_geral ?? fallback.observacao_geral,
        dias: raw.dias,
        cardio: raw.cardio ?? fallback.cardio,
      };
    }
    // plano de dia único do schema antigo → converte
    if (Array.isArray(raw.exercicios) && raw.exercicios.length >= 3) {
      return {
        ...fallback,
        dias: [
          {
            nome: "A · Treino principal",
            foco: fallback.dias[0]?.foco ?? "Geral",
            aquecimento: fallback.dias[0]?.aquecimento ?? [],
            exercicios: raw.exercicios,
            finalizador: fallback.dias[0]?.finalizador ?? FINISHERS[0],
          },
        ],
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/** Briefing do dia do personal (usado no cockpit). */
export function briefingOffline(input: {
  activeToday: number;
  totalStudents: number;
  missesWeek: number;
  prescribedToday: number;
  pendingApprovals: number;
  worstStudent?: string | null;
  worstDays?: number;
  topStudent?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `${input.activeToday} de ${input.totalStudents} alunos ativos hoje, ${input.prescribedToday} treino${input.prescribedToday === 1 ? "" : "s"} prescrito${input.prescribedToday === 1 ? "" : "s"}.`
  );
  if (input.worstStudent && input.worstDays && input.worstDays >= 3) {
    parts.push(`Maior risco: ${input.worstStudent.split(" ")[0]}, ${input.worstDays} dias sem aparecer.`);
  } else if (input.pendingApprovals > 0) {
    parts.push(`${input.pendingApprovals} solicitaç${input.pendingApprovals === 1 ? "ão" : "ões"} de aluno${input.pendingApprovals === 1 ? "" : "s"} esperando sua decisão.`);
  } else {
    parts.push("Nenhum alerta crítico agora, aprove pra revisar cargas da semana.");
  }
  parts.push(
    input.topStudent
      ? `Comece pelo check-in de ${input.topStudent.split(" ")[0]} e confirme a execução do treino novo.`
      : "Comece pela lista de Aprovações e depois valide os check-ins."
  );
  return parts.join(" ");
}

/** Insight por aluno (aba do sheet) derivado dos dados locais. */
export function insightOffline(input: {
  name: string;
  streak: number;
  lastTrainingDaysAgo: number;
  lastRpe?: number;
  weights: number[];
  activeWorkout?: string | null;
}): string {
  const w = input.weights;
  const delta = w.length >= 2 ? Math.round((w[w.length - 1] - w[0]) * 10) / 10 : 0;
  const first = input.name.split(" ")[0];
  if (input.lastTrainingDaysAgo >= 3) {
    return `${first} está há ${input.lastTrainingDaysAgo} dias sem treinar e o risco de evasão é alto. Dispare um WhatsApp hoje com um chamado leve pra volta, sem cobrar pesado.`;
  }
  if ((input.lastRpe ?? 0) >= 9) {
    return `${first} registrou RPE ${input.lastRpe} no último treino, sinal de fadiga acumulada. Reduza 10% da carga principal do próximo treino e reforce a técnica antes de subir de novo.`;
  }
  if (delta > 0.5) {
    return `${first} evoluiu ${delta} kg com aderência estável, o plano atual está funcionando. Mantenha a execução e suba a carga do exercício principal quando fechar as reps no RPE alvo.`;
  }
  if (input.streak >= 5) {
    return `${first} acumula ${input.streak} dias de consistência, momento ideal pra variar o estímulo. Troque 1 exercício acessório do ${input.activeWorkout ?? "treino"} por uma variação nova mantendo o foco.`;
  }
  return `${first} está no ritmo, mas o volume semanal ainda é curto. Reforce 1 sessão extra na semana, mesmo que curta, pra acelerar a adaptação.`;
}
