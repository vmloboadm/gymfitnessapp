/**
 * Uma única resposta para "qual é o treino de hoje?".
 *
 * Fontes, nesta ordem:
 * 1. o dia escrito no nome do treino ("Seg · A · Peito") — é o que o
 *    personal montou e vale mesmo que daysSelected venha fora de ordem;
 * 2. daysSelected do plano ativo;
 * 3. available_days do perfil (fallback);
 * 4. rotação A/B/C quando o plano não tem dia fixo.
 *
 * Dia não programado é descanso. Nada de "faltou" em domingo por causa de
 * uma sequência fixa.
 */

const TIME_ZONE = "America/Sao_Paulo";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type TrainingPlanDay = {
  nome?: string;
  foco?: string;
  slot?: string;
  exercicios?: unknown[];
};

export type TrainingPlan = {
  id?: string;
  /** assigned_at do student_workouts; evita cobrar falta de antes do plano. */
  created_at?: string;
  plan?: {
    daysSelected?: string[];
    dias?: TrainingPlanDay[];
  } | null;
};

export type TrainingDayInput = {
  plan: TrainingPlan | null;
  today: Date;
  logs?: Array<{ date: string }>;
  slotChecks?: Array<{ slot: string; checked_at: string }>;
  fallbackDays?: string[];
};

export type MissedTraining = {
  dayIdx: number;
  slot: string;
  weekday: Weekday;
  daysAgo: number;
  day: TrainingPlanDay;
};

export type TrainingDayState = {
  status: "scheduled" | "rest" | "no-plan";
  day: TrainingPlanDay | null;
  dayIdx: number;
  slot: string;
  scheduledWeekdays: Weekday[];
  completedToday: boolean;
  missed: MissedTraining | null;
  /** Próximo treino para o botão secundário "treinar mesmo assim". */
  optionalDayIdx: number;
  optionalSlot: string;
  weeklyGoal: number;
};

function dayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return y && m && d ? `${y}-${m}-${d}` : "";
}

function weekdayIndex(key: string): number {
  // Meio-dia em São Paulo cai no mesmo dia em UTC; getUTCDay evita o fuso
  // do aparelho do aluno.
  return new Date(`${key}T12:00:00-03:00`).getUTCDay();
}

export function normalizeWeekday(value: string | null | undefined): Weekday | null {
  const s = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const m = s.match(/^(dom|seg|ter|qua|qui|sex|sab)/);
  if (!m) return null;
  const base = m[1];
  if (base === "dom") return "Dom";
  if (base === "seg") return "Seg";
  if (base === "ter") return "Ter";
  if (base === "qua") return "Qua";
  if (base === "qui") return "Qui";
  if (base === "sex") return "Sex";
  return "Sáb";
}

function weekdayFromDay(day: TrainingPlanDay): Weekday | null {
  return normalizeWeekday(day.nome) ?? normalizeWeekday(day.foco);
}

function slotOf(day: TrainingPlanDay, idx: number): string {
  return day.slot ?? "ABCDEF"[idx] ?? String(idx + 1);
}

function uniqueWeekdays(list: Array<Weekday | null>): Weekday[] {
  const seen = new Set<Weekday>();
  const out: Weekday[] = [];
  for (const w of list) {
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function rotationIndex(slotChecks: Array<{ slot: string; checked_at: string }> | undefined, days: TrainingPlanDay[]): number {
  if (!slotChecks?.length || days.length === 0) return 0;
  const last = [...slotChecks].sort(
    (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  )[0];
  const idx = days.findIndex((d, i) => slotOf(d, i) === last.slot);
  return idx >= 0 ? (idx + 1) % days.length : 0;
}

function mapWeekdayToIndex(
  weekday: Weekday,
  explicit: Array<{ day: TrainingPlanDay; idx: number; weekday: Weekday | null }>,
  selected: Weekday[],
  daysLength: number
): number {
  const byName = explicit.find((d) => d.weekday === weekday);
  if (byName) return byName.idx;
  const pos = selected.indexOf(weekday);
  return pos >= 0 ? pos % daysLength : 0;
}

export function resolveTrainingDay(input: TrainingDayInput): TrainingDayState {
  const days = input.plan?.plan?.dias ?? [];
  const fallback = uniqueWeekdays((input.fallbackDays ?? []).map(normalizeWeekday));
  const selected = uniqueWeekdays((input.plan?.plan?.daysSelected ?? []).map(normalizeWeekday));

  if (!input.plan || days.length === 0) {
    return {
      status: "no-plan",
      day: null,
      dayIdx: 0,
      slot: "",
      scheduledWeekdays: selected.length ? selected : fallback,
      completedToday: false,
      missed: null,
      optionalDayIdx: 0,
      optionalSlot: "",
      weeklyGoal: selected.length || fallback.length || 0,
    };
  }

  const explicit = days.map((day, idx) => ({ day, idx, weekday: weekdayFromDay(day) }));
  const explicitWeekdays = uniqueWeekdays(explicit.map((d) => d.weekday));
  // daysSelected é a fonte primária. O nome do dia só manda quando o plano
  // não tem dias fixos (fluxos antigos). Sem isso, um plano Seg/Qua/Sex com
  // dias nomeados Seg..Sex aparecia como treino na terça.
  const scheduledWeekdays = selected.length ? selected : explicitWeekdays.length ? explicitWeekdays : fallback;
  const fixed = scheduledWeekdays.length > 0;
  const slotChecks = input.slotChecks;
  const todayKey = dayKey(input.today);
  const todayIdx = weekdayIndex(todayKey);
  const todayWeekday = WEEKDAYS[todayIdx];
  const logDays = new Set((input.logs ?? []).map((l) => dayKey(new Date(l.date))).filter(Boolean));
  const completedToday = logDays.has(todayKey);

  // Qual ficha fazer é SEMPRE a rotação (próxima depois da última feita),
  // salvo quando o personal escreveu o dia no nome ("Seg · A"). Os dias
  // marcados só dizem se hoje é dia de treino ou descanso. Antes a ficha
  // ficava presa ao dia da semana: ABCDE em 3 dias nunca mostrava D/E e a
  // quarta sugeria C sem o aluno ter feito A e B.
  const byName = explicitWeekdays.length > 0;
  const rotation = rotationIndex(slotChecks, days);
  let scheduled = false;
  let dayIdx = rotation;
  if (scheduledWeekdays.length > 0) {
    const pos = scheduledWeekdays.indexOf(todayWeekday);
    if (pos >= 0) {
      scheduled = true;
      if (byName) dayIdx = mapWeekdayToIndex(todayWeekday, explicit, scheduledWeekdays, days.length);
    }
  } else {
    // Sem dias fixos: a rotação vale todo dia.
    scheduled = true;
  }

  // O próximo treino para "treinar mesmo assim": se hoje é programado, é o
  // próprio; se é descanso, é o próximo dia programado (ou o próximo slot).
  let optionalDayIdx = dayIdx;
  if (!scheduled) {
    if (byName && scheduledWeekdays.length > 0) {
      let best: { weekday: Weekday; delta: number } | null = null;
      for (const w of scheduledWeekdays) {
        const idx = WEEKDAYS.indexOf(w);
        const delta = (idx - todayIdx + 7) % 7 || 7;
        if (!best || delta < best.delta) best = { weekday: w, delta };
      }
      if (best) {
        optionalDayIdx = mapWeekdayToIndex(best.weekday, explicit, scheduledWeekdays, days.length);
      }
    } else {
      optionalDayIdx = rotationIndex(slotChecks, days);
    }
  }

  // Pendência: o dia programado mais recente (até 6 dias atrás) sem nenhum
  // log. Só existe quando a programação é fixa; rotação não tem "faltou".
  let missed: MissedTraining | null = null;
  // Pendência só faz sentido com dia escrito no nome; na rotação o treino
  // não feito simplesmente continua sendo o próximo.
  if (fixed && byName && scheduledWeekdays.length > 0) {
    // Só a semana corrente conta. Na terça, a sexta anterior é de outra
    // semana e não pode aparecer como "faltou".
    const daysSinceMonday = (todayIdx + 6) % 7;
    const weekStart = dayKey(new Date(input.today.getTime() - daysSinceMonday * 86_400_000));
    const assignedKey = input.plan.created_at ? dayKey(new Date(input.plan.created_at)) : "";
    let best: { weekday: Weekday; daysAgo: number; idx: number } | null = null;
    for (const w of scheduledWeekdays) {
      const wi = WEEKDAYS.indexOf(w);
      const daysAgo = (todayIdx - wi + 7) % 7;
      if (daysAgo === 0 || daysAgo > 6) continue;
      const key = dayKey(new Date(input.today.getTime() - daysAgo * 86_400_000));
      if (key < weekStart) continue;
      if (assignedKey && key < assignedKey) continue;
      if (logDays.has(key)) continue;
      if (!best || daysAgo < best.daysAgo) {
        best = { weekday: w, daysAgo, idx: mapWeekdayToIndex(w, explicit, scheduledWeekdays, days.length) };
      }
    }
    if (best) {
      const d = days[best.idx];
      missed = {
        dayIdx: best.idx,
        slot: slotOf(d, best.idx),
        weekday: best.weekday,
        daysAgo: best.daysAgo,
        day: d,
      };
    }
  }

  const day = scheduled ? days[dayIdx] : null;
  const optionalDay = days[optionalDayIdx] ?? null;

  return {
    status: scheduled ? "scheduled" : fixed ? "rest" : "scheduled",
    day,
    dayIdx: scheduled ? dayIdx : optionalDayIdx,
    slot: day ? slotOf(day, dayIdx) : "",
    scheduledWeekdays,
    completedToday,
    missed,
    optionalDayIdx,
    optionalSlot: optionalDay ? slotOf(optionalDay, optionalDayIdx) : "",
    weeklyGoal: scheduledWeekdays.length || days.length,
  };
}
