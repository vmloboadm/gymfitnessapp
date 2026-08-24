/* Mocks tipados do Dashboard do Aluno.
   Simulam as tabelas/respostas do Supabase para desenvolvimento.
   Regras de pontuação da constância (comentadas para o backend futuro):

   - Check-in na academia .................... = 10 pts
   - Aulão de fim de semana confirmado ....... = 30 pts
   - Bater a meta semanal (frequência) ....... = 50 pts
   - O ranking ZERA todo dia 1º (período mensal)
*/

export type Gender = "masculino" | "feminino";

/** Títulos mensais por gênero — desbloqueados por check-ins + streak no mês. */
export interface TitleDef {
  id: string;
  label: string;
  /** [minCheckins, minStreak] para desbloquear. */
  req: [number, number];
}

export const MASC_TITLES: TitleDef[] = [
  { id: "novato", label: "Novato", req: [0, 0] },
  { id: "constante", label: "Constante", req: [10, 5] },
  { id: "dedicado", label: "Dedicado", req: [20, 10] },
  { id: "ferro", label: "Ferro", req: [30, 15] },
  { id: "lenda", label: "Lenda", req: [40, 21] },
];

export const FEM_TITLES: TitleDef[] = [
  { id: "iniciante", label: "Iniciante", req: [0, 0] },
  { id: "firme", label: "Firme", req: [10, 5] },
  { id: "guerreira", label: "Guerreira", req: [20, 10] },
  { id: "titania", label: "Titânia", req: [30, 15] },
  { id: "valquiria", label: "Valquíria", req: [40, 21] },
];

export const POINTS_RULES = { CHECKIN: 10, AULAO: 30, META_SEMANAL: 50 } as const;

export interface MonthlyScore {
  total: number;
  checkins: number;
  auloes: number;
  metasBatidas: number;
}

/** Estado de prontidão por região muscular (mock de telemetria). */
export interface MuscleState {
  id: "superiores" | "core" | "inferiores";
  label: string;
  /** 0-100 — prontidão para treinar. */
  readiness: number;
  state: "pronto" | "recuperacao" | "fadiga";
}

export interface FocusRecommendation {
  /** Chave do filtro no /treino (query param ?foco=). */
  bodyCat: string;
  label: string;
  reason: string;
}

export interface CommunityFeat {
  author: string;
  role: string;
  text: string;
  /** Foto de perfil (obrigatória — pra já, mock com pravatar). */
  avatar: string;
  /** Dono da conquista (para notificar em reação 🔥). */
  ownerId?: string;
}

export interface Sponsor {
  name: string;
  msg: string;
  url: string;
}

/** Heurística simples de gênero pelo primeiro nome (mock; Supabase terá coluna própria). */
export function inferGender(name?: string | null): Gender {
  const first = (name ?? "").trim().split(" ")[0];
  if (!first) return "masculino";
  return /a$/.test(first) ? "feminino" : "masculino";
}

/** Situação da academia no momento — frases por horário (mock de ocupação). */
export function livePulse(hour: number, online: number): { phrase: string; occupancy: number } {
  const occ = Math.min(1, online / 30);
  if (hour >= 18 && hour < 21) {
    return { phrase: `${online} atletas ficando no shape agora. Sinta a energia e inspire-se!`, occupancy: occ };
  }
  if (hour < 7) {
    return { phrase: "A academia está vazia. Domine os pesos em silêncio!", occupancy: 0.08 };
  }
  if (hour >= 7 && hour < 9) {
    return { phrase: "Ninguém chegou ainda, aproveite e corra pra cá!", occupancy: 0.15 };
  }
  if (hour >= 21) {
    return { phrase: `${online} persistindo no treino da noite. Respeita!`, occupancy: occ };
  }
  return { phrase: "Tem pouca gente, venha treinar e faça novas amizades!", occupancy: 0.3 };
}

/** Mock de score mensal + carga (kg) movida no mês. */
export const monthlyScore: MonthlyScore = { total: 450, checkins: 27, auloes: 1, metasBatidas: 3 };
export const monthlyKg = 5800;

/** Prontidão muscular mock — inferiores prontos, superiores em recuperação. */
export const muscleSnapshot: MuscleState[] = [
  { id: "superiores", label: "Superiores", readiness: 10, state: "fadiga" },
  { id: "core", label: "Core", readiness: 68, state: "recuperacao" },
  { id: "inferiores", label: "Inferiores", readiness: 95, state: "pronto" },
];

export const focusToday: FocusRecommendation = {
  bodyCat: "perna",
  label: "Inferiores",
  reason: "Pernas estão prontas (95%) e superiores ainda se recuperam.",
};

/** Sequência padrão da ficha do aluno (ABC) — define o próximo treino sugerido. */
export const WORKOUT_SEQUENCE: FocusRecommendation[] = [
  { bodyCat: "peito", label: "Peito & Tríceps", reason: "Sequência da ficha" },
  { bodyCat: "costas", label: "Costas & Bíceps", reason: "Sequência da ficha" },
  { bodyCat: "perna", label: "Pernas & Glúteos", reason: "Sequência da ficha" },
  { bodyCat: "ombro", label: "Ombros", reason: "Sequência da ficha" },
  { bodyCat: "braco", label: "Braços", reason: "Sequência da ficha" },
  { bodyCat: "abdomen", label: "Core", reason: "Sequência da ficha" },
];

/**
 * Próximo treino da SEQUÊNCIA da ficha — baseado no último treino realizado.
 * Se o aluno faltou um dia, o treino perdido NÃO é pulado: o índice avança só
 * quando o dia com treino é registrado (continua de onde parou).
 */
export function nextWorkoutFromLogs(
  logs: Array<{ date: string }>,
  today = new Date()
): FocusRecommendation & { resume: boolean } {
  const seq = WORKOUT_SEQUENCE;
  const day = 86400000;
  const now = today.getTime();
  const todayStr = today.toISOString().slice(0, 10);

  // último dia com treino (mais recente até ontem, para permitir "continuar de onde parou")
  const doneDays = [...new Set(logs.map((l) => l.date.slice(0, 10)))]
    .filter((d) => d < todayStr)
    .sort();

  // quantos "ciclos de ficha" foram completados até agora
  const progress = doneDays.length;
  const next = seq[progress % seq.length];

  // faltou ontem → é retomada do treino perdido
  const yesterday = new Date(now - day).toISOString().slice(0, 10);
  const trainedYesterday = logs.some((l) => l.date.slice(0, 10) === yesterday);
  const trainedToday = logs.some((l) => l.date.slice(0, 10) === todayStr);

  const resume = !trainedToday && doneDays.length > 0 && !trainedYesterday;

  return { ...next, resume };
}

export const spotlightSponsor: Sponsor = {
  name: "Hortifruti Campos",
  msg: "Desconto de R$ 15 em compras acima de R$ 80 para alunos GymFitness.",
  url: "https://www.google.com/",
};

/* ---------- Dica do dia (estrutura pronta p/ posts do Instagram) ---------- */
export type TipOfTheDay = {
  text: string;
  /** Origem futura: post educativo no IG da academia. */
  source?: { kind: "instagram"; url?: string; image?: string; handle?: string };
};

export const TIPS_STRUCTURED: TipOfTheDay[] = [
  { text: "Descanso é treino: durma 7–8h pra hipertrofia acontecer.", source: { kind: "instagram", handle: "@gymfitness" } },
  { text: "Cadência controlada na descida vale mais que carga jogada.", source: { kind: "instagram", handle: "@gymfitness" } },
  { text: "Água antes do café: desempenho cai com desidratação leve.", source: { kind: "instagram", handle: "@gymfitness" } },
];

/* ---------- Destaques da academia (mock carrossel) ---------- */
export const GYM_HIGHLIGHTS = [
  { icon: "👑", tag: "Aluno do mês", title: "Marina Costa", body: "12 treinos no mês e liga Ouro conquistada." },
  { icon: "🏆", tag: "Recorde recente", title: "Leg press · 320kg", body: "Lucas Andrade cravou novo recorde da casa." },
  { icon: "📅", tag: "Evento", title: "Aula aberta sábado 9h", body: "Funcional em grupo — traga um amigo." },
];
