/**
 * Motor local de IA (modo offline / demo sem chave OmniRoute).
 * Produz a MESMA saída JSON que os system prompts pedem aos modelos:
 * plano multi-dias completo com aquecimento, RPE, dicas, finalizador,
 * cardio semanal e progressão. Também gera briefing e insights.
 *
 * v2: Aceita exercícios reais do banco (DBExercises), equipamentos,
 * metadados do aluno (sexo, nível, dias disponíveis, restrições)
 * e gera planos respeitando a disponibilidade semanal.
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

/** Exercício vindo do banco (tabela exercises). */
export type DBExercise = {
  id: string;
  name: string;
  category: string;
  muscles?: string[] | null;
  equipment_id?: string | null;
  photo_url?: string | null;
  tips?: string[] | null;
};

/** Equipamento vindo do banco (tabela equipment). */
export type DBEquipment = {
  id: string;
  name: string;
  category: string;
};

/** Dados do aluno para o gerador. */
export type StudentContext = {
  name?: string;
  sex?: string | null;
  experience_level?: string | null;
  available_days?: string[] | null;
  goal?: string | null;
  medical_risk?: boolean | null;
  medications?: string | null;
  birth_date?: string | null;
  restrictions?: string | null;
};

type LibEntry = { name: string; group: string; info: string; equipmentName?: string | null };

/** Constrói a flat list a partir de exercícios reais do banco. */
function buildFlatFromDB(exercises: DBExercise[], equipment: DBEquipment[]): LibEntry[] {
  const eqMap = new Map(equipment.map((e) => [e.id, e.name]));
  return exercises
    .filter((e) => e.name.toLowerCase() !== "registro livre")
    .map((e) => ({
      name: e.name,
      group: e.category,
      info: (e.tips ?? []).join(". "),
      equipmentName: eqMap.get(e.equipment_id ?? "") ?? null,
    }));
}

/** Constrói a flat list a partir do demoLib (fallback offline). */
function buildFlatFromDemo(): LibEntry[] {
  return demoLib.flatMap((c) =>
    c.subs.flatMap((sub) =>
      sub.exercises.map((e) => ({
        name: e.name,
        group: c.name,
        info: e.info ?? "",
      }))
    )
  );
}

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

/** Mapeamento de nomes de dias da semana para abreviações. */
const DAY_MAP: Record<string, string> = {
  "Segunda": "Seg", "Terça": "Ter", "Quarta": "Qua", "Quinta": "Qui", "Sexta": "Sex", "Sábado": "Sáb", "Domingo": "Dom",
  "Segunda-feira": "Seg", "Terça-feira": "Ter", "Quarta-feira": "Qua", "Quinta-feira": "Qui", "Sexta-feira": "Sex",
  "seg": "Seg", "ter": "Ter", "qua": "Qua", "qui": "Qui", "sex": "Sex", "sáb": "Sáb", "sab": "Sáb", "dom": "Dom",
  "segunda": "Seg", "terca": "Ter", "terça": "Ter", "quarta": "Qua", "quinta": "Qui", "sexta": "Sex", "sabado": "Sáb", "sábado": "Sáb", "domingo": "Dom",
  "Seg": "Seg", "Ter": "Ter", "Qua": "Qua", "Qui": "Qui", "Sex": "Sex", "Sáb": "Sáb", "Dom": "Dom",
};

function normalizeDay(d: string): string {
  return DAY_MAP[d] ?? d.slice(0, 3);
}

/** Palavras que indicam problema/lesão → viram RESTRIÇÃO, não foco muscular. */
const INJURY_RE = /problema|dor|d[oó]i|inc[ôo]modo|incomodo|les[ãa]o|lesion|inflam|sens[íi]vel|sensivel|fr[áa]gil|fragil|fraco|cirurgi|opera[cç][ãa]o|estour|disloc|desloc|trauma|fratura|tens[ãa]o|r[íi]gid|n[ãa]o (pode|consigo|aguenta|levanta|agacha|faz)|evitar|evite|descol|lux[aã]|distens|tend[ií]nit/g;

/** Partes do corpo e o que significam em contexto de lesão vs treino. */
const BODY_PARTS: Array<{
  re: RegExp;
  focus: string | null;
  rest: string;
}> = [
  { re: /ombro|deltoide/, focus: "Ombro", rest: "Cuidado com ombro" },
  { re: /joelho/, focus: "Inferiores", rest: "Cuidado com joelho" },
  { re: /lombar|coluna/, focus: "Corpo inteiro", rest: "Cuidado com lombar" },
  { re: /pesco[cç]o|cervical/, focus: null, rest: "Cuidado com cervical" },
  { re: /punho/, focus: null, rest: "Cuidado com punho" },
  { re: /cotovelo/, focus: null, rest: "Cuidado com cotovelo" },
  { re: /quadril/, focus: null, rest: "Cuidado com quadril" },
  { re: /tornozelo/, focus: null, rest: "Cuidado com tornozelo" },
];

/** Interpreta o pedido em linguagem natural. */
export function parseIntent(prompt: string): {
  focus: string[];
  freq: number;
  level: "Iniciante" | "Intermediário" | "Avançado";
  restrictions: string[];
  goal: string;
} {
  const p = prompt.toLowerCase();
  const restrictions: string[] = [];
  const injuredMuscles = new Set<string>();

  const isInjury = INJURY_RE.test(p);
  for (const part of BODY_PARTS) {
    if (!part.re.test(p)) continue;
    if (isInjury) {
      restrictions.push(part.rest);
      if (part.focus) injuredMuscles.add(part.focus);
    }
  }
  // restrições explícitas
  if (/sem impacto|baixo impacto|articula/.test(p)) restrictions.push("Sem impacto articular");
  if (/em casa|casa|viagem|sem aparelho|sem equipamento/.test(p)) restrictions.push("Sem equipamentos");
  if (isInjury && /joelho/.test(p) && !restrictions.includes("Cuidado com joelho")) restrictions.push("Cuidado com joelho");
  if (isInjury && /lombar|coluna/.test(p) && !restrictions.includes("Cuidado com lombar")) restrictions.push("Cuidado com lombar");

  // foco: só entra se a parte não estiver lesionada
  const focus: string[] = [];
  const addFocus = (f: string) => { if (!focus.includes(f)) focus.push(f); };
  if (/gl[úu]teo|bumbum/.test(p) && !injuredMuscles.has("Glúteo")) addFocus("Glúteo");
  if (/perna|inferior|coxa|quadr[íi]ceps/.test(p) && !injuredMuscles.has("Inferiores")) addFocus("Inferiores");
  if (/peito|supino|peitoral/.test(p) && !injuredMuscles.has("Peito")) addFocus("Peito");
  if (/costa|dorsal|puxad/.test(p) && !injuredMuscles.has("Costas")) addFocus("Costas");
  if (/ombro|deltoide/.test(p) && !injuredMuscles.has("Ombro")) addFocus("Ombro");
  if (/b[íi]ceps|rosca/.test(p) && !injuredMuscles.has("Braço")) addFocus("Braço");
  if (/tr[íi]ceps|ros[aã]o/.test(p) && !injuredMuscles.has("Braço")) addFocus("Braço");
  if (/bra[çc]o/.test(p) && !injuredMuscles.has("Braço")) addFocus("Braço");
  if (/abd|core|barriga/.test(p)) addFocus("Abdômen / Core");
  if (/posterior|femoral/.test(p) && !injuredMuscles.has("Posterior")) addFocus("Posterior");
  if (focus.length === 0) focus.push("Corpo inteiro");

  const freq = Number(p.match(/(\d)\s?x/)?.[1] ?? 3);
  const level: "Iniciante" | "Intermediário" | "Avançado" =
    /iniciante|come[çc]ando|primeira vez|leve/.test(p)
      ? "Iniciante"
      : /avan[çc]ado|atleta|experiente/.test(p)
        ? "Avançado"
        : "Intermediário";

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

/* ------------------------- Periodização (split) ------------------------- */

type DayType = "Full Body" | "Superiores" | "Inferiores" | "Empurrar" | "Puxar" | "Pernas" | "Braços";

const DAY_FOCO: Record<DayType, string> = {
  "Full Body": "Corpo inteiro · todos os grupos",
  Superiores: "Peito, costas, ombro e braços",
  Inferiores: "Pernas, posterior e glúteos",
  Empurrar: "Peito, ombro e tríceps",
  Puxar: "Costas e bíceps",
  Pernas: "Quadríceps, posterior e glúteos",
  Braços: "Bíceps e tríceps",
};

const DAY_MUSCLES: Record<DayType, string[]> = {
  "Full Body": ["Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Inferiores", "Posterior", "Glúteo", "Abdômen / Core"],
  Superiores: ["Peito", "Costas", "Ombro", "Bíceps", "Tríceps"],
  Inferiores: ["Inferiores", "Posterior", "Glúteo", "Abdômen / Core"],
  Empurrar: ["Peito", "Ombro", "Tríceps"],
  Puxar: ["Costas", "Bíceps"],
  Pernas: ["Inferiores", "Posterior", "Glúteo", "Abdômen / Core"],
  Braços: ["Bíceps", "Tríceps"],
};

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Monta a sequência de dias da semana por periodização REAL:
 * 4x semana NÃO significa 4 treinos diferentes — usa Upper A / Lower A /
 * Upper B / Lower B (2 treinos distintos repetidos), PPL ou rotação de
 * Full Body, conforme frecuencia, nível e foco.
 */
function splitArchetypes(
  numDays: number,
  level: string,
  o: { lowerFocus: boolean; gluteFocus: boolean; upperFocus: boolean; armsFocus: boolean }
): Array<{ type: DayType; bias: "upper" | "lower" | null }> {
  const ppl = (i: number): { type: DayType; bias: null } =>
    [
      { type: "Empurrar" as DayType, bias: null },
      { type: "Puxar" as DayType, bias: null },
      { type: "Pernas" as DayType, bias: null },
    ][i % 3];

  // Foco em pernas/glúteo → pernas dominante
  if (o.lowerFocus || o.gluteFocus) {
    if (numDays <= 2) return [{ type: "Inferiores", bias: null }, { type: "Superiores", bias: null }];
    if (numDays === 3) return [{ type: "Inferiores", bias: null }, { type: "Superiores", bias: null }, { type: "Inferiores", bias: null }];
    if (numDays === 4) return Array.from({ length: 4 }, (_, i) => ({ type: (i % 2 === 0 ? "Inferiores" : "Superiores") as DayType, bias: null }));
    if (numDays === 5) return Array.from({ length: 5 }, (_, i) => ({ type: (i % 2 === 0 ? "Inferiores" : "Superiores") as DayType, bias: null }));
    return Array.from({ length: numDays }, (_, i) => ({ type: (i % 2 === 0 ? "Inferiores" : "Superiores") as DayType, bias: null }));
  }

  // Foco em braços
  if (o.armsFocus) {
    if (numDays <= 2) return [{ type: "Braços", bias: null }, { type: "Superiores", bias: null }];
    if (numDays === 3) return [{ type: "Braços", bias: null }, { type: "Empurrar", bias: null }, { type: "Puxar", bias: null }];
    if (numDays === 4) return [{ type: "Braços", bias: null }, { type: "Inferiores", bias: null }, { type: "Braços", bias: null }, { type: "Superiores", bias: null }];
    return Array.from({ length: numDays }, (_, i) =>
      [
        { type: "Braços" as DayType, bias: null },
        { type: "Empurrar" as DayType, bias: null },
        { type: "Puxar" as DayType, bias: null },
        { type: "Inferiores" as DayType, bias: null },
      ][i % 4]);
  }

  // Foco em superiores/membros superiores
  if (o.upperFocus) {
    if (numDays === 2) return [{ type: "Superiores", bias: null }, { type: "Inferiores", bias: null }];
    if (numDays === 3) return [{ type: "Empurrar", bias: null }, { type: "Puxar", bias: null }, { type: "Pernas", bias: null }];
    if (numDays === 4) return [{ type: "Superiores", bias: null }, { type: "Inferiores", bias: null }, { type: "Superiores", bias: null }, { type: "Inferiores", bias: null }];
    if (numDays === 5) return [{ type: "Superiores", bias: null }, { type: "Inferiores", bias: null }, { type: "Empurrar", bias: null }, { type: "Puxar", bias: null }, { type: "Pernas", bias: null }];
    return Array.from({ length: numDays }, (_, i) => ppl(i));
  }

  // Genérico
  if (numDays === 2) return [{ type: "Full Body", bias: "upper" }, { type: "Full Body", bias: "lower" }];
  if (numDays === 3) {
    if (level === "Iniciante") return [
      { type: "Full Body", bias: "upper" },
      { type: "Full Body", bias: null },
      { type: "Full Body", bias: "lower" },
    ];
    return Array.from({ length: 3 }, (_, i) => ppl(i));
  }
  if (numDays === 4) return [
    { type: "Superiores", bias: null },
    { type: "Inferiores", bias: null },
    { type: "Superiores", bias: null },
    { type: "Inferiores", bias: null },
  ];
  if (numDays === 5) return [
    { type: "Superiores", bias: null },
    { type: "Inferiores", bias: null },
    { type: "Empurrar", bias: null },
    { type: "Puxar", bias: null },
    { type: "Pernas", bias: null },
  ];
  return Array.from({ length: numDays }, (_, i) => ppl(i));
}

function warmKeyFor(type: DayType, gluteFocus: boolean): "superior" | "inferior" | "geral" | "gluteo" {
  if (gluteFocus && (type === "Inferiores" || type === "Pernas")) return "gluteo";
  if (type === "Full Body") return "geral";
  if (type === "Inferiores" || type === "Pernas") return "inferior";
  return "superior";
}

/** Penalidade por restrição: exercícios que sobrecarregam a região a evitar. */
const RESTRICTION_PENALTIES: Record<string, RegExp> = {
  "Cuidado com ombro": /supino|desenvolvimento|desenv.*halter|eleva[çc][ãa]o (lateral|frontal)|crucifixo invertido|tr[íi]ceps franc[êe]s|franc[êe]s|mergulho|paralelas|voador/,
  "Cuidado com joelho": /agachamento livre|salto|burpee|corrida|afundo livre|leg press|agachamento smith/,
  "Cuidado com lombar": /levantamento terra|stiff|hiperextens|bom dia|agachamento livre com barra|peso morto|barbell row|remada curvada com barra/,
  "Cuidado com punho": /flex[aã]o de punho|extens[aã]o de punho|rosca inversa|tr[íi]ceps testa com barra/,
  "Cuidado com cotovelo": /tr[íi]ceps testa|franc[êe]s|mergulho|paralelas/,
  "Cuidado com cervical": /desenvolvimento|encolhimento/,
};

/** Exercícios compostos recebem um pequeno bônus (bases do treino). */
const COMPOUND_RE = /supino reto|supino inclinado|agachamento|leg press|cadeira extensora|puxada frontal|remada curvada|remada .*m[áa]quina|levantamento terra|desenvolvimento militar|stiff|cadeira flexora|hip thrust/;

function scoreExercise(
  e: LibEntry,
  focus: string[],
  restrictions: string[],
  bias: "upper" | "lower" | null,
  _student?: StudentContext
): number {
  let s = 0;
  const text = (e.name + " " + e.group).toLowerCase();
  if (focus.includes("Glúteo") && /gl[úu]teo|quadril|pélvica|abdutor|stiff|coice|afundo|hip thrust|eleva[çc][ãa]o p[ée]lvica/.test(text)) s += 4;
  if (focus.includes("Inferiores") && /inferior|perna|leg|agach|extensor|flexor|panturrilha|afundo/.test(text)) s += 3;
  if (focus.includes("Peito") && /peito|supino|crucifixo|voador|flexão|paralelas|peck/.test(text)) s += 3;
  if (focus.includes("Costas") && /costa|puxada|remada|barra fixa|pulldown|dorsal/.test(text)) s += 3;
  if (focus.includes("Ombro") && /ombro|desenvolv|eleva[çc][ãa]o (lateral|frontal)/.test(text)) s += 3;
  if (focus.includes("Bíceps") && /rosca|b[íi]ceps/.test(text)) s += 3;
  if (focus.includes("Tríceps") && /tr[íi]ceps|franc[êe]s|mergulho|paralelas/.test(text)) s += 3;
  if (focus.includes("Abdômen / Core") && /abd|prancha|abdominal|eleva[çc][ãa]o de pernas|bicicleta no solo|russian twist|crunch/.test(text)) s += 3;
  if (focus.includes("Posterior") && /stiff|femoral|mesa|posterior/.test(text)) s += 4;
  if (COMPOUND_RE.test(text) && focus.length > 1) s += 1;

  // restrições
  for (const [restr, re] of Object.entries(RESTRICTION_PENALTIES)) {
    if (restrictions.includes(restr) && re.test(text)) s -= 6;
  }
  if (restrictions.includes("Sem impacto articular") && /polia|m[áa]quina|p[ée]lvica|abdutor|el[íi]ptico|supino na m[áa]quina/.test(text)) s += 2;
  if (restrictions.includes("Sem impacto articular") && /salto|corrida|burpee/.test(text)) s -= 5;
  if (restrictions.includes("Sem equipamentos") && /peso corporal|solo|ch[aã]o|sem peso|flex[aã]o|agachamento livre/.test(text)) s += 3;
  if (restrictions.includes("Sem equipamentos") && /polia|m[áa]quina|barra|halter/.test(text)) s -= 4;

  // viés de Full Body A/B (dá variedade entre dias de corpo inteiro)
  if (bias === "upper" && /peito|supino|costa|puxada|remada|ombro|b[íi]ceps|tr[íi]ceps|rosca/.test(text)) s += 1;
  if (bias === "lower" && /perna|leg|agach|extensor|flexor|posterior|gl[úu]teo|panturrilha|afundo|stiff|hip|p[ée]lvica|abdutora|adutora/.test(text)) s += 1;

  // nível iniciante: prefere máquinas e peso corporal (mais seguros/estáveis)
  if (_student?.experience_level === "Iniciante") {
    if (/m[áa]quina|polia|leg press|cadeira|banco demo|guiado|halteres?/.test(text)) s += 1;
    if (/agachamento livre|levantamento terra|mergulho|paralelas/.test(text)) s -= 1;
  }

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
  dayType: DayType,
  focus: string[],
  restrictions: string[],
  level: string,
  goal: string,
  seed: number,
  warmKey: "superior" | "inferior" | "geral" | "gluteo",
  pool: LibEntry[],
  bias: "upper" | "lower" | null,
  student?: StudentContext
): PlanDay {
  const rx = prescriptionFor(level, goal);
  const scored = pool
    .map((e) => ({ e, s: scoreExercise(e, focus, restrictions, bias, student) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  // jitter determinístico por dia: entre exercícios com o mesmo score,
  // o desempate varia de dia para dia (variedade controlada no split)
  const chosen: LibEntry[] = [];
  for (const { e } of scored) {
    if (chosen.length >= 6) break;
    if (!chosen.some((c) => c.name === e.name)) chosen.push(e);
  }
  // completa com compostos seguros se faltar
  const fillers = pool.filter((e) => !chosen.some((c) => c.name === e.name));
  while (chosen.length < 5 && fillers.length) {
    const sorted = [...fillers].sort(
      (a, b) => (hashCode(b.name) + seed) % 97 - (hashCode(a.name) + seed) % 97
    );
    const pick = sorted.shift();
    if (pick && !chosen.some((c) => c.name === pick.name)) {
      chosen.push(pick);
      sorted.pop();
    } else {
      break;
    }
  }

  return {
    nome: label,
    foco: DAY_FOCO[dayType],
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

/**
 * Gera o plano completo (multi-dias) a partir do pedido do personal.
 *
 * @param prompt - pedido em linguagem natural
 * @param studentName - nome do aluno
 * @param options.dbExercises - exercícios reais do banco (opcional, usa demoLib se ausente)
 * @param options.equipment - equipamentos reais do gym (opcional)
 * @param options.student - dados completos do aluno (sexo, nível, dias, etc.)
 * @param options.daysSelected - dias da semana selecionados pelo personal
 * @param options.daysMeta - metadados estruturados coletados pelo assistente (IA faz perguntas)
 */
export function generatePlanOffline(
  prompt: string,
  studentName?: string,
  options?: {
    dbExercises?: DBExercise[];
    equipment?: DBEquipment[];
    student?: StudentContext;
    daysSelected?: string[];
    daysMeta?: {
      nivel?: string | null;
      objetivo?: string | null;
      focus?: string[] | null;
      restricoes?: string[] | null;
      observacoes?: string | null;
    };
  }
): WorkoutPlan {
  const intent = parseIntent(prompt);
  const seed = prompt.length + prompt.charCodeAt(0);

  const nivel = options?.daysMeta?.nivel ?? options?.student?.experience_level ?? intent.level;
  const objetivo = options?.daysMeta?.objetivo ?? intent.goal;
  const focoMeta = options?.daysMeta?.focus ?? [];
  const restricoes = [
    ...(options?.daysMeta?.restricoes ?? []),
    ...intent.restrictions,
  ].filter((r) => r && r !== "Nenhuma");
  void focoMeta;

  // Usa exercícios reais do banco se disponíveis, senão fallback pro demoLib
  const pool: LibEntry[] = options?.dbExercises?.length
    ? buildFlatFromDB(options.dbExercises, options.equipment ?? [])
    : buildFlatFromDemo();

  // Determina quantos dias gerar: usa daysSelected, depois intent.freq
  const selectedDays = options?.daysSelected?.map(normalizeDay) ?? [];
  const numDays = selectedDays.length > 0
    ? selectedDays.length
    : intent.freq;

  const dayLabels = selectedDays.length > 0
    ? selectedDays
    : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].slice(0, numDays);

  // Quando o assistente guia (diasMeta), o foco é distribuído no split; senão
  // deriva do prompt (mas nunca trata lesão como foco).
  const flags = {
    lowerFocus: intent.focus.some((f) => ["Inferiores", "Posterior", "Glúteo"].includes(f)),
    gluteFocus: intent.focus.includes("Glúteo"),
    upperFocus: intent.focus.some((f) => ["Peito", "Costas", "Ombro"].includes(f)),
    armsFocus: intent.focus.includes("Braço"),
  };

  const archetypes = splitArchetypes(numDays, nivel, flags);

  // distribuição do foco guiado pelo assistente, se ele escolheu um plano
  const guidedFocus = options?.daysMeta?.focus?.length ? options.daysMeta.focus : null;
  const isFocusPlan = guidedFocus ? !guidedFocus.includes("Corpo inteiro") && !guidedFocus.includes("Todos") : !intent.focus.includes("Corpo inteiro");

  const days: PlanDay[] = [];
  for (let d = 0; d < numDays; d++) {
    const arche = archetypes[d % archetypes.length];
    const weekday = dayLabels[d] ?? "";

    // se o assistente escolheu um foco único (ex.: pernas), substitui o archetype
    let type = arche.type;
    if (isFocusPlan && (flags.lowerFocus || flags.gluteFocus) && !flags.upperFocus && !flags.armsFocus) {
      type = d % 2 === 0 ? "Inferiores" : "Superiores";
    } else if (isFocusPlan && (flags.upperFocus || flags.armsFocus) && !flags.lowerFocus) {
      type = d % 2 === 0 ? "Superiores" : "Inferiores";
    }

    const focusGroups = DAY_MUSCLES[type];
    const warmKey = warmKeyFor(type, flags.gluteFocus);

    const focusPool = pool.filter((e) => {
      const t = (e.name + " " + e.group).toLowerCase();
      return focusGroups.some((f) => {
        const key = f === "Inferiores" ? "inferior"
          : f === "Glúteo" ? "gl[úu]teo"
            : f === "Bíceps" ? "rosca|b[íi]ceps"
              : f === "Tríceps" ? "tr[íi]ceps|franc[êe]s|mergulho"
                : f === "Abdômen / Core" ? "abd|prancha|abdominal"
                  : f.toLowerCase().slice(0, 5);
        return new RegExp(key).test(t);
      });
    });

    const label = `${weekday ? weekday + " · " : ""}${DAY_FOCO[type] ? type : "Treino"}`.replace(/ · +/g, " · ").trim();
    days.push(
      buildDay(
        label,
        type,
        focusGroups,
        restricoes.length ? restricoes : [],
        nivel,
        objetivo,
        seed + d * 13,
        warmKey,
        focusPool.length >= 8 ? focusPool : pool,
        arche.bias,
        options?.student
      )
    );
  }

  const focusLabel = isFocusPlan ? (guidedFocus ?? intent.focus).join(" + ") : "Full Body";

  const parts = [
    `Plano de ${numDays}x semana com foco em ${focusLabel.toLowerCase()} para ${studentName ?? "o aluno"}.`,
    `Nível ${nivel.toLowerCase()}.`,
  ];
  if (options?.student?.sex) parts.push(`Sexo: ${options.student.sex === "M" ? "masculino" : "feminino"}.`);
  if (options?.student?.medications) parts.push(`Medicamentos: ${options.student.medications}.`);
  if (restricoes.length) parts.push(`Restrições respeitadas: ${restricoes.join(", ").toLowerCase()}.`);
  if (options?.daysMeta?.observacoes) parts.push(`Observações: ${options.daysMeta.observacoes}.`);
  parts.push("Progressão: complete as reps no RPE alvo e some 2.5 kg nos superiores e 5 kg nos inferiores na semana seguinte.");

  return {
    nome: `${focusLabel} · ${nivel}`,
    frequencia: `${numDays}x semana`,
    daysSelected: dayLabels,
    nivel,
    objetivo,
    observacao_geral: parts.join(" "),
    dias: days,
    cardio:
      objetivo === "Emagrecimento"
        ? "25 min de esteira ou elíptico em ritmo moderado após 3 treinos da semana."
        : "10 a 15 min de cardio leve ao final de 2 treinos, sem prejudicar a recuperação.",
  };
}

/**
 * Valida e normaliza nomes de exercícios do LLM contra a biblioteca real.
 * Retorna o plano com nomes corrigidos (fuzzy match).
 */
export function validateAndFixExercises(
  plan: WorkoutPlan,
  dbExercises: DBExercise[]
): WorkoutPlan {
  if (!dbExercises.length) return plan;

  const exNames = dbExercises.map((e) => e.name.toLowerCase());
  const exMap = new Map(dbExercises.map((e) => [e.name.toLowerCase(), e.name]));

  function fuzzyMatch(name: string): string {
    const lower = name.toLowerCase();
    // Match exato
    if (exMap.has(lower)) return exMap.get(lower)!;
    // Match parcial: nome do LLM contém nome do DB ou vice-versa
    for (const [dbName, dbDisplay] of exMap) {
      if (lower.includes(dbName) || dbName.includes(lower)) return dbDisplay;
    }
    // Match por palavras-chave: primeira palavra
    const firstWord = lower.split(" ")[0];
    for (const [dbName, dbDisplay] of exMap) {
      if (dbName.startsWith(firstWord) && firstWord.length >= 4) return dbDisplay;
    }
    // Sem match: retorna o nome original (o approve vai usar placeholder)
    return name;
  }

  return {
    ...plan,
    dias: plan.dias.map((day) => ({
      ...day,
      exercicios: day.exercicios.map((ex) => ({
        ...ex,
        exercicio: fuzzyMatch(ex.exercicio),
      })),
    })),
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
        daysSelected: raw.daysSelected ?? fallback.daysSelected,
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
