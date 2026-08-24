/**
 * Ponte Demo → Supabase. Quando NEXT_PUBLIC_DEMO_MODE=1, faz com que
 * queries comuns do app retornem dados rich em vez de vazio/erro.
 * Uso: envie a query ao Supabase; se falhar ou voltar vazia no demo,
 * use demoFallback(entity) para obter dados de exemplo.
 */
import {
  demoEquipment,
  demoVariations,
  demoExercises,
  demoWorkoutProgram,
  demoWorkoutDays,
  demoStudentWorkout,
  demoWorkoutExercises,
  demoWorkoutLogs,
  demoRanking,
  demoProfiles,
  demoSeedInfo,
  demoLib,
  demoLibCategory,
  type DemoCategory,
  type DemoExercise,
} from "./demo-data";

export {
  demoEquipment,
  demoVariations,
  demoExercises,
  demoWorkoutProgram,
  demoWorkoutDays,
  demoStudentWorkout,
  demoWorkoutExercises,
  demoWorkoutLogs,
  demoRanking,
  demoProfiles,
  demoLib,
  demoLibCategory,
  type DemoCategory,
  type DemoExercise,
};

export type EntityName =
  | "equipment"
  | "equipment_variations"
  | "exercises"
  | "workout_programs"
  | "workout_days"
  | "student_workouts"
  | "workout_exercises"
  | "workout_logs"
  | "leaderboard"
  | "profiles";

export const isDemoMode = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export function demoSeedSummary() {
  return isDemoMode() ? demoSeedInfo() : null;
}

/**
 * Retorna fallback demo para uma tabela/entidade quando a query rel
 * falhou ou veio vazia. Retorna null quando não há fallback definido.
 */
export function demoFallback(entity: EntityName): any[] | null {
  if (!isDemoMode()) return null;
  switch (entity) {
    case "equipment":
      return demoEquipment;
    case "equipment_variations":
      return Object.values(demoVariations).flat();
    case "exercises":
      return demoExercises;
    case "workout_programs":
      return [demoWorkoutProgram];
    case "workout_days":
      return demoWorkoutDays;
    case "student_workouts":
      return [demoStudentWorkout];
    case "workout_exercises":
      return demoWorkoutExercises;
    case "workout_logs":
      return demoWorkoutLogs();
    case "leaderboard":
      return demoRanking;
    case "profiles":
      return demoProfiles;
    default:
      return null;
  }
}

/**
 * Helper p/ queries com maybeSingle: devolve o primeiro item do fallback.
 */
export function demoFallbackOne(entity: EntityName): any | null {
  const rows = demoFallback(entity);
  return rows && rows.length ? rows[0] : null;
}

/**
 * Variações demo de um equipamento específico.
 */
export function demoVariationsFor(equipmentId: string): any[] {
  if (!isDemoMode()) return [];
  return demoVariations[equipmentId] ?? [];
}

// ---------------------------------------------------------------------------
// Dados compostos (helper) para as telas do aluno ficarem vivas no demo
// ---------------------------------------------------------------------------

export function demoTreinoData() {
  return {
    workouts: demoStudentWorkout,
    program: demoWorkoutProgram,
    details: demoWorkoutExercises.map((w: any) => ({
      ...w,
      exercise: demoExercises.find((e) => e.id === w.exercise_id) ?? null,
    })),
    logs: demoWorkoutLogs(),
    days: demoWorkoutDays,
  };
}

export function demoProgressoData() {
  const logs = demoWorkoutLogs().slice(0, 90);
  const byDay = new Map<string, number>();
  for (const l of logs) {
    const k = l.date.slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  return {
    logs,
    prevLogs: logs.slice(0, 30),
    checkins: [...byDay.entries()].map(([date]) => ({
      id: `ck-${date}`,
      gym_id: "1",
      student_id: "00000000-0000-0000-0000-000000000099",
      type: "entrada",
      source: "nfc",
      checked_at: date + "T08:00:00",
    })),
  };
}

export function demoMetricsData() {
  return {
    metrics: [
      { id: "bm-1", gym_id: "1", student_id: "00000000-0000-0000-0000-000000000099", recorded_at: new Date(Date.now() - 40 * 86400000).toISOString(), weight_kg: 92, height_m: 1.78, bmi: 29.0, body_fat_pct: 26, muscle_kg: 62, waist_cm: 98, source: "manual" },
      { id: "bm-2", gym_id: "1", student_id: "00000000-0000-0000-0000-000000000099", recorded_at: new Date(Date.now() - 14 * 86400000).toISOString(), weight_kg: 89.5, height_m: 1.78, bmi: 28.2, body_fat_pct: 24, muscle_kg: 64, waist_cm: 94, source: "bioimpedancia" },
      { id: "bm-3", gym_id: "1", student_id: "00000000-0000-0000-0000-000000000099", recorded_at: new Date(Date.now() - 2 * 86400000).toISOString(), weight_kg: 87.2, height_m: 1.78, bmi: 27.5, body_fat_pct: 22.5, muscle_kg: 65.5, waist_cm: 91, source: "bioimpedancia" },
    ] as any[],
  };
}

export function demoFeedData() {
  const now = Date.now();
  return {
    posts: [
      { id: "f1", gym_id: "1", author_id: "u2", type: "geral", body: "Treino de perna monstruoso hoje! 🔥 5 exercícios, 20 séries no total. Quem acompanha?", media_url: null, created_at: new Date(now - 3600000).toISOString(), expires_at: null, is_pinned: false },
      { id: "f2", gym_id: "1", author_id: "u1", type: "comunicado", body: "Novo recado do personal: supino reto agora com pausa isométrica de 2s no final das repetições. Vale testar no check-in!", media_url: null, created_at: new Date(now - 5200000).toISOString(), expires_at: null, is_pinned: true },
      { id: "f3", gym_id: "1", author_id: "u3", type: "desafio", body: "Bateram meu recorde no leg press: 320kg x 8 💪 Chama no desafio da semana!", media_url: null, created_at: new Date(now - 90000000).toISOString(), expires_at: null, is_pinned: false },
      { id: "f4", gym_id: "1", author_id: "u4", type: "conquista", body: "Fechei a meta da semana com 4 treinos! Meta do mês tá próxima 🏆", media_url: null, created_at: new Date(now - 120000000).toISOString(), expires_at: null, is_pinned: false },
    ] as any[],
    likes: [
      { id: "l1", gym_id: "1", post_id: "f1", user_id: "u3", created_at: new Date(now - 3000000).toISOString() },
      { id: "l2", gym_id: "1", post_id: "f1", user_id: "u4", created_at: new Date(now - 2000000).toISOString() },
      { id: "l3", gym_id: "1", post_id: "f2", user_id: "u2", created_at: new Date(now - 4000000).toISOString() },
      { id: "l4", gym_id: "1", post_id: "f3", user_id: "u1", created_at: new Date(now - 80000000).toISOString() },
      { id: "l5", gym_id: "1", post_id: "f3", user_id: "u2", created_at: new Date(now - 70000000).toISOString() },
      { id: "l6", gym_id: "1", post_id: "f3", user_id: "u4", created_at: new Date(now - 60000000).toISOString() },
      { id: "l7", gym_id: "1", post_id: "f4", user_id: "u1", created_at: new Date(now - 100000000).toISOString() },
    ] as any[],
    comments: [
      { id: "c1", gym_id: "1", post_id: "f1", user_id: "u3", body: "Bora! Amanhã eu tô lá no horário da noite 💪", created_at: new Date(now - 3400000).toISOString() },
      { id: "c2", gym_id: "1", post_id: "f1", user_id: "u4", body: "Boa! Perna toda semana é assim que vira 🦵", created_at: new Date(now - 3000000).toISOString() },
      { id: "c3", gym_id: "1", post_id: "f3", user_id: "u2", body: "Monstro! Vou tentar te alcançar no desafio 😤", created_at: new Date(now - 85000000).toISOString() },
      { id: "c4", gym_id: "1", post_id: "f4", user_id: "u1", body: "Parabéns! Constância é isso aí 👏", created_at: new Date(now - 110000000).toISOString() },
    ] as any[],
  };
}

export function demoOnlineAgora(): number {
  return 8 + Math.floor(Math.random() * 6);
}

// ---------------------------------------------------------------------------
// Home/Dashboard — cards de mundo fit, patrocinadores e destaques
// ---------------------------------------------------------------------------

export function demoMundoFit() {
  return [
    {
      id: "mf-1",
      source: "Health & Fitness",
      title: "HIIT de 15 min: por que queima mais que 1h de esteira",
      body: "Estudos recentes apontam que treinos intervalados de alta intensidade elevam o metabolismo por até 24h após a sessão.",
      url: "#",
    },
    {
      id: "mf-2",
      source: "Nutrition Today",
      title: "Proteína: quanto consumir no dia para ganhar massa",
      body: "A recomendação prática para quem treina força fica em 1,6–2,2g por kg de peso corporal, distribuídos em 3–4 refeições.",
      url: "#",
    },
    {
      id: "mf-3",
      source: "Biohacking BR",
      title: "Recuperação: o impacto do sono na hipertrofia",
      body: "Dormir menos de 6h pode reduzir em até 30% a síntese proteica muscular no dia seguinte. Priorize 7–8h.",
      url: "#",
    },
  ];
}

export type Patrocinador = {
  id: string;
  name: string;
  msg: string;
  discount: number;
  url: string;
  /** Cor primária da marca (usada em monograma prime quando não há logo). */
  brand: string;
  /** Logo do parceiro (upload no cadastro real). Sem logo → monograma premium. */
  logo?: string;
};

export function demoPatrocinadores(): Patrocinador[] {
  return [
    {
      id: "sp-1",
      name: "Açaí do Forte",
      msg: "15% off no açaí para alunos GymFitness.",
      discount: 15,
      url: "https://wa.me/5522999990001",
      brand: "#6D28D9",
    },
    {
      id: "sp-2",
      name: "Nutri Camila",
      msg: "Avaliação nutricional com 15% de desconto.",
      discount: 15,
      url: "https://www.instagram.com/nutricamila",
      brand: "#0FA968",
    },
    {
      id: "sp-3",
      name: "Hortifruti Campos",
      msg: "15% off em compras acima de R$ 80.",
      discount: 15,
      url: "https://wa.me/5522999990003",
      brand: "#15803D",
    },
    {
      id: "sp-4",
      name: "Mix Costura",
      msg: "15% de desconto no ajuste de uniformes.",
      discount: 15,
      url: "https://wa.me/5522999990004",
      brand: "#2563EB",
    },
  ];
}

/** Código único de resgate por aluno + parceiro (rastreabilidade de negócio). */
export function codeResgate(partnerId: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GYM-${partnerId.slice(-2).toUpperCase()}${rand}`;
}

export function demoDestaquesAcademia() {
  return [
    {
      id: "f-1",
      author: "Ana Júlia",
      role: "Aluna",
      avatar: "https://i.pravatar.cc/80?img=47",
      ownerId: "u4",
      text: "Bateu o RP no agachamento hoje, parabéns Ana! 🎉",
    },
    {
      id: "f-2",
      author: "Lucas Andrade",
      role: "Aluno",
      avatar: "https://i.pravatar.cc/80?img=12",
      text: "Fechou 30 dias de constância sem faltar. Isso é disciplina, parabéns Lucas! 🏆",
    },
    {
      id: "f-3",
      author: "Marina Costa",
      role: "Aluna",
      avatar: "https://i.pravatar.cc/80?img=45",
      text: "Bateu a meta da semana com o 4º treino. Só alegria, parabéns Marina! ❤️",
    },
    {
      id: "f-4",
      author: "Pedro Rocha",
      role: "Aluno",
      avatar: "https://i.pravatar.cc/80?img=15",
      text: "Venceu a meta do mês no ranking da academia. Orgulho de ter você aqui! 🥇",
    },
  ];
}

// ---------------------------------------------------------------------------
// Gestor — KPIs e financeiro
// ---------------------------------------------------------------------------

export function demoKpis() {
  return {
    students: 142,
    trainers: 6,
    equipment: 10,
    activeCheckins: 9,
    revenue: 18420,
    revenueDeltaPct: 12.4,
  };
}

// ---------------------------------------------------------------------------
// Gestor — dashboard de decisão (ocupação por horário, check-in por plano,
// manutenção recorrente, tendência de receita)
// ---------------------------------------------------------------------------

export function demoOcupacaoHorario() {
  const hours = ["6h", "8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"];
  const values = [18, 34, 22, 40, 25, 30, 58, 62, 28];
  return hours.map((h, i) => ({ hora: h, alunos: values[i] }));
}

export function demoCheckinPorPlano() {
  return [
    { plano: "Mensal", alunos: 86, checkins: 498, taxa: 64 },
    { plano: "Gympass", alunos: 34, checkins: 152, taxa: 48 },
    { plano: "TotalPass", alunos: 12, checkins: 61, taxa: 52 },
    { plano: "Trimestral", alunos: 10, checkins: 52, taxa: 61 },
  ];
}

export function demoManutencaoRecorrente() {
  return [
    { id: "eq-demo-008", name: "Remada Curvada", abertos: 3, resolvidos: 1, ultimo: "há 4 dias" },
    { id: "eq-demo-002", name: "Agachamento Smith", abertos: 2, resolvidos: 0, ultimo: "hoje" },
    { id: "eq-demo-005", name: "Esteira Elétrica", abertos: 1, resolvidos: 2, ultimo: "há 2 dias" },
  ];
}

export function demoTendenciaReceita() {
  const months = ["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"];
  const values = [14200, 14850, 15600, 16120, 16980, 18420];
  return months.map((m, i) => ({ mes: m, receita: values[i] }));
}

export function demoFinanceiro() {
  return {
    mrr: 18420,
    mrrDeltaPct: 12.4,
    overdue: [
      { id: "sub-1", student_name: "Carlos Menezes", plan_name: "Mensal", price: 129.9, ends_at: new Date(Date.now() - 2 * 86400000).toISOString(), status: "expired" },
      { id: "sub-2", student_name: "Juliana Ramos", plan_name: "Gympass", price: 149.9, ends_at: new Date(Date.now() - 5 * 86400000).toISOString(), status: "expired" },
    ],
    subscriptions: [
      { id: "sub-3", student_name: "Atleta Demo", plan_name: "Mensal", price: 129.9, ends_at: new Date(Date.now() + 20 * 86400000).toISOString(), status: "active", type: "monthly" },
      { id: "sub-4", student_name: "Lucas Andrade", plan_name: "Trimestral", price: 349.9, ends_at: new Date(Date.now() + 10 * 86400000).toISOString(), status: "active", type: "monthly" },
    ],
  };
}

export function demoMatriculas() {
  return [
    { id: "m-1", student: { name: "Marina Costa", email: "marina@gmail.com" }, plan_name: "Mensal", type: "monthly", status: "active", price: 129.9, starts_at: new Date(Date.now() - 40 * 86400000).toISOString(), ends_at: new Date(Date.now() + 10 * 86400000).toISOString() },
    { id: "m-2", student: { name: "Pedro Rocha", email: "pedro@gmail.com" }, plan_name: "Gympass", type: "gympass", status: "active", price: 149.9, starts_at: new Date(Date.now() - 30 * 86400000).toISOString(), ends_at: new Date(Date.now() + 5 * 86400000).toISOString() },
    { id: "m-3", student: { name: "Ana Souza", email: "ana@gmail.com" }, plan_name: "Mensal", type: "monthly", status: "expired", price: 129.9, starts_at: new Date(Date.now() - 60 * 86400000).toISOString(), ends_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: "m-4", student: { name: "Carlos Menezes", email: "carlos@gmail.com" }, plan_name: "TotalPass", type: "totalpass", status: "active", price: 199.9, starts_at: new Date(Date.now() - 20 * 86400000).toISOString(), ends_at: new Date(Date.now() + 40 * 86400000).toISOString() },
  ];
}

export function demoPersonais() {
  return [
    { id: "p-1", trainer: { name: "Rafael Oliveira", email: "rafael@fit.com" }, students: 18 },
    { id: "p-2", trainer: { name: "Camila Ferreira", email: "camila@fit.com" }, students: 15 },
    { id: "p-3", trainer: { name: "Diego Santos", email: "diego@fit.com" }, students: 22 },
  ];
}

export function demoRelatorios() {
  const days = 7;
  const byDay = new Array(days).fill(0).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      day: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      checkins: 18 + Math.round(Math.random() * 20),
      volume: 2500 + Math.round(Math.random() * 3500),
    };
  });
  return { byDay };
}

// ---------------------------------------------------------------------------
// Personal — biblioteca/alunos/treinos
// ---------------------------------------------------------------------------

export function demoBiblioteca() {
  return [
    { id: "ex-demo-001", name: "Supino Reto", category: "Peito", muscles: ["Peitoral"], photo_url: null, tips: ["Escápulas retraídas e pés firmes no chão"], high_impact: false },
    { id: "ex-demo-002", name: "Agachamento", category: "Perna", muscles: ["Quadríceps", "Glúteo"], photo_url: null, tips: ["Joelhos acompanham a linha dos pés"], high_impact: false },
    { id: "ex-demo-003", name: "Leg Press 45°", category: "Perna", muscles: ["Quadríceps", "Glúteo"], photo_url: null, tips: ["Não trave totalmente os joelhos"], high_impact: false },
    { id: "ex-demo-004", name: "Remada Curvada", category: "Costas", muscles: ["Dorsal", "Trapézio"], photo_url: null, tips: ["Cotovelos próximos ao corpo"], high_impact: false },
    { id: "ex-demo-005", name: "Puxada Alta", category: "Costas", muscles: ["Dorsal"], photo_url: null, tips: ["Puxe até a clavícula"], high_impact: false },
    { id: "ex-demo-006", name: "Esteira", category: "Cardio", muscles: ["Sistema cardiovascular"], photo_url: null, tips: ["Incline e aumente gradativamente"], high_impact: true },
    { id: "ex-demo-007", name: "Elevação Lateral", category: "Ombro", muscles: ["Deltoide"], photo_url: null, tips: ["Cotovelos levemente flexionados"], high_impact: false },
    { id: "ex-demo-008", name: "Rosca Direta", category: "Bíceps", muscles: ["Bíceps"], photo_url: null, tips: ["Sem balançar o tronco"], high_impact: false },
  ] as any[];
}

export function demoAlunosPersonal() {
  return [
    { id: "00000000-0000-0000-0000-000000000099", name: "Atleta Demo", email: "demo@stackgym.fit", status: "active", workout_active: true, last_workout: new Date().toISOString(), streak: 8 },
    { id: "a-1", name: "Marina Costa", email: "marina@gmail.com", status: "active", workout_active: true, last_workout: new Date(Date.now() - 86400000).toISOString(), streak: 5 },
    { id: "a-2", name: "Pedro Rocha", email: "pedro@gmail.com", status: "active", workout_active: false, last_workout: new Date(Date.now() - 3 * 86400000).toISOString(), streak: 2 },
    { id: "a-3", name: "Ana Souza", email: "ana@gmail.com", status: "active", workout_active: true, last_workout: new Date(Date.now() - 2 * 86400000).toISOString(), streak: 11 },
  ] as any[];
}

export function demoTreinosTemplate() {
  return [
    { id: "t-1", name: "Iniciante Geral", level: "Iniciante", muscles: ["Full body"], days: 3, exercises: 21, objective: "Adaptação" },
    { id: "t-2", name: "Força & Hipertrofia A", level: "Intermediário", muscles: ["Peito", "Tríceps", "Costas"], days: 4, exercises: 28, objective: "Hipertrofia" },
    { id: "t-3", name: "Avançado Push/Pull/Legs", level: "Avançado", muscles: ["Full body"], days: 6, exercises: 42, objective: "Hipertrofia avançada" },
  ] as any[];
}