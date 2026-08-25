/**
 * Camada de dados DEMO, injeta conteúdo rico e realista quando
 * NEXT_PUBLIC_DEMO_MODE=1, para que todas as telas pareçam vivas
 * mesmo sem login/banco. Nunca é usado em produção.
 */

export const isDemo = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

export const demoEquipment = [
  {
    id: "eq-demo-001",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Supino Reto",
    category: "strength",
    capacity: 8,
    status: "available",
    nfc_tag_url: "gym://eq/001",
    qr_url: "EQ001",
    map_position: { x: 12, y: 18 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-002",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Agachamento Smith",
    category: "strength",
    capacity: 6,
    status: "available",
    nfc_tag_url: "gym://eq/002",
    qr_url: "EQ002",
    map_position: { x: 30, y: 14 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-003",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Leg Press 45°",
    category: "strength",
    capacity: 10,
    status: "available",
    nfc_tag_url: "gym://eq/003",
    qr_url: "EQ003",
    map_position: { x: 50, y: 20 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-004",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Puxada Alta",
    category: "strength",
    capacity: 6,
    status: "available",
    nfc_tag_url: "gym://eq/004",
    qr_url: "EQ004",
    map_position: { x: 70, y: 12 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-005",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Esteira Elétrica",
    category: "cardio",
    capacity: 6,
    status: "available",
    nfc_tag_url: "gym://eq/005",
    qr_url: "EQ005",
    map_position: { x: 88, y: 24 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-006",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Bicicleta Ergométrica",
    category: "cardio",
    capacity: 8,
    status: "in_use",
    nfc_tag_url: "gym://eq/006",
    qr_url: "EQ006",
    map_position: { x: 88, y: 40 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-007",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Cadeira Extensora",
    category: "strength",
    capacity: 6,
    status: "available",
    nfc_tag_url: "gym://eq/007",
    qr_url: "EQ007",
    map_position: { x: 22, y: 34 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-008",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Remada Curvada",
    category: "strength",
    capacity: 6,
    status: "maintenance",
    nfc_tag_url: null,
    qr_url: "EQ008",
    map_position: { x: 45, y: 42 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-009",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Mesa Flexora",
    category: "strength",
    capacity: 6,
    status: "available",
    nfc_tag_url: "gym://eq/009",
    qr_url: "EQ009",
    map_position: { x: 62, y: 38 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "eq-demo-010",
    gym_id: "00000000-0000-0000-0000-000000000001",
    name: "Crossover Polia",
    category: "strength",
    capacity: 4,
    status: "available",
    nfc_tag_url: "gym://eq/010",
    qr_url: "EQ010",
    map_position: { x: 78, y: 50 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
] as any[];

// ---------------------------------------------------------------------------
// Variações de exercício por equipamento
// ---------------------------------------------------------------------------

export const demoVariations: Record<string, any[]> = {
  "eq-demo-001": [
    { id: "var-001", name: "Supino Reto com Barra", default_sets: 4, default_reps: 10 },
    { id: "var-002", name: "Supino Reto com Halteres", default_sets: 4, default_reps: 12 },
    { id: "var-003", name: "Supino com Pegada Fechada", default_sets: 3, default_reps: 8 },
    { id: "var-004", name: "Supino Inclinado", default_sets: 4, default_reps: 10 },
    { id: "var-005", name: "Supino com Pausa Isométrica", default_sets: 3, default_reps: 8 },
  ],
  "eq-demo-002": [
    { id: "var-006", name: "Agachamento Tradicional", default_sets: 4, default_reps: 8 },
    { id: "var-007", name: "Agachamento com Pausa", default_sets: 4, default_reps: 6 },
    { id: "var-008", name: "Agachamento Pino Alto", default_sets: 4, default_reps: 10 },
    { id: "var-009", name: "Agachamento Sumô", default_sets: 3, default_reps: 12 },
    { id: "var-010", name: "Agachamento Isométrico", default_sets: 3, default_reps: 30 },
    { id: "var-011", name: "Agachamento Unilateral", default_sets: 3, default_reps: 10 },
  ],
  "eq-demo-003": [
    { id: "var-012", name: "Leg Press 45° Tradicional", default_sets: 4, default_reps: 12 },
    { id: "var-013", name: "Leg Press Com Pés Altos", default_sets: 4, default_reps: 12 },
    { id: "var-014", name: "Leg Press Pés Baixos", default_sets: 4, default_reps: 12 },
    { id: "var-015", name: "Leg Press Unilateral", default_sets: 3, default_reps: 10 },
    { id: "var-016", name: "Leg Press com Pausa", default_sets: 3, default_reps: 10 },
  ],
  "eq-demo-004": [
    { id: "var-017", name: "Puxada Frente Aberta", default_sets: 4, default_reps: 10 },
    { id: "var-018", name: "Puxada Triângulo", default_sets: 4, default_reps: 12 },
    { id: "var-019", name: "Puxada Frente Fechada", default_sets: 3, default_reps: 10 },
    { id: "var-020", name: "Pulldown Pronado", default_sets: 4, default_reps: 10 },
    { id: "var-021", name: "Pulldown Supinado", default_sets: 3, default_reps: 12 },
  ],
  "eq-demo-007": [
    { id: "var-022", name: "Extensão Tradicional", default_sets: 4, default_reps: 12 },
    { id: "var-023", name: "Extensão com Pausa", default_sets: 3, default_reps: 10 },
    { id: "var-024", name: "Extensão Unilateral", default_sets: 3, default_reps: 10 },
  ],
  "eq-demo-009": [
    { id: "var-025", name: "Flexão Tradicional", default_sets: 4, default_reps: 12 },
    { id: "var-026", name: "Flexão com Pausa", default_sets: 3, default_reps: 10 },
    { id: "var-027", name: "Flexão Unilateral", default_sets: 3, default_reps: 8 },
  ],
};

// ---------------------------------------------------------------------------
// Exercícios (biblioteca)
// ---------------------------------------------------------------------------

export const demoExercises = [
  { id: "ex-demo-001", name: "Supino Reto", category: "strength", muscles: ["chest"], tips: ["Mantenha escápulas retraídas"], technique_default: "standard", high_impact: false },
  { id: "ex-demo-002", name: "Agachamento", category: "strength", muscles: ["legs"], tips: ["Joelhos acompanham os pés"], technique_default: "standard", high_impact: false },
  { id: "ex-demo-005", name: "Puxada Alta", category: "strength", muscles: ["back"], tips: ["Puxe com cotovelos baixos"], technique_default: "standard", high_impact: false },
  { id: "ex-demo-006", name: "Esteira", category: "cardio", muscles: ["legs"], tips: ["Comece em ritmo leve"], technique_default: "standard", high_impact: true },
] as any[];

// ---------------------------------------------------------------------------
// Treino/programa demo
// ---------------------------------------------------------------------------

const iso = (daysAgo: number, hour = 12) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10) + `T${String(hour).padStart(2, "0")}:00:00`;

export const demoWorkoutProgram = {
  id: "prog-demo-001",
  gym_id: "00000000-0000-0000-0000-000000000001",
  trainer_id: "00000000-0000-0000-0000-000000000002",
  name: "Força & Hipertrofia - A",
  objective: "Hipertrofia",
  created_via: "manual",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as any;

export const demoWorkoutDays = [
  { id: "day-demo-001", gym_id: "00000000-0000-0000-0000-000000000001", program_id: "prog-demo-001", name: "Dia 1 - Peito & Tríceps", day_order: 1 },
  { id: "day-demo-002", gym_id: "00000000-0000-0000-0000-000000000001", program_id: "prog-demo-001", name: "Dia 2 - Costas & Bíceps", day_order: 2 },
  { id: "day-demo-003", gym_id: "00000000-0000-0000-0000-000000000001", program_id: "prog-demo-001", name: "Dia 3 - Pernas", day_order: 3 },
] as any[];

export const demoStudentWorkout = {
  id: "sw-demo-001",
  gym_id: "00000000-0000-0000-0000-000000000001",
  student_id: "00000000-0000-0000-0000-000000000099",
  program_id: "prog-demo-001",
  status: "active",
  assigned_at: iso(14),
  started_at: iso(12),
  completed_at: null,
} as any;

const we = (n: number, exId: string, sets: number, reps: string, rest: number) =>
  ({ id: `we-demo-${String(n).padStart(3, "0")}`, gym_id: "00000000-0000-0000-0000-000000000001", day_id: "day-demo-001", exercise_id: exId, variation_id: null, sets, reps, rest_seconds: rest, rpe: 7 + (n % 3), notes: null, technique: "standard", order: n });

export const demoWorkoutExercises = [
  we(1, "ex-demo-001", 4, "10", 90), // Supino Reto
  we(2, "ex-demo-007", 3, "12", 60), // Desenvolvimento Militar
  we(3, "ex-demo-005", 4, "10", 75), // Puxada Alta
  we(4, "ex-demo-008", 3, "12", 45), // Rosca Direta
  we(5, "ex-demo-002", 4, "8", 90),  // Agachamento
  we(6, "ex-demo-006", 1, "15min", 0), // Esteira (finalizador)
] as any[];

// novos exercícios do catálogo usado acima
for (const extra of [
  { id: "ex-demo-007", name: "Desenvolvimento Militar", category: "strength", muscles: ["shoulders"], tips: ["Core firme, sem arco lombar"], technique_default: "standard", high_impact: false },
  { id: "ex-demo-008", name: "Rosca Direta", category: "strength", muscles: ["biceps"], tips: ["Sem balançar o tronco"], technique_default: "standard", high_impact: false },
]) {
  if (!demoExercises.some((e: any) => e.id === extra.id)) {
    (demoExercises as any[]).push({ ...extra, gym_id: "00000000-0000-0000-0000-000000000001", equipment_id: null, photo_url: null, video_url: null, created_at: new Date().toISOString() } as any);
  }
}

export const demoWorkoutLogs = () => {
  const logs = [] as any[];
  const base = 60;
  /* Frequência realista de constância: treina seg/qua/sex/dom (4x semana),
     hoje sempre treinado (streak viva), ontem ainda não treinado (meta em progresso). */
  const PATTERN = [0, 1, 3, 5]; // getDay(): 0=dom, 1=seg, 3=qua, 5=sex
  for (let d = 0; d < 28; d++) {
    const date = new Date(Date.now() - d * 86400000);
    const dow = date.getDay();
    let train = PATTERN.includes(dow);
    if (d === 0) train = true; // hoje SEMPRE em progresso (nunca concluído, senão a aba Treino morre)
    if (d === 1) train = false; // ontem ainda não
    if (!train) continue;
    const count = d === 0 ? 1 : 1 + Math.round(Math.random()); // hoje: 1 série fixa (progresso parcial)
    /* divisão semanal: dom/qua = pernas · seg/sex = peito · qui = costas
       → alimenta o estado REAL de recuperação do mapa corporal */
    const SPLIT: Record<number, string> = { 0: "ex-demo-002", 3: "ex-demo-002", 4: "ex-demo-005", 1: "ex-demo-001", 5: "ex-demo-001" };
    const exId = SPLIT[dow] ?? "ex-demo-001";
    for (let i = 0; i < count; i++) {
      logs.push({
        id: `log-demo-${d}-${i}`,
        gym_id: "00000000-0000-0000-0000-000000000001",
        student_id: "00000000-0000-0000-0000-000000000099",
        workout_id: "sw-demo-001",
        exercise_id: exId,
        session_id: null,
        date: iso(d, 9 + i),
        weight_kg: base + d * 2 + i * 5 + Math.round(Math.random() * 4),
        reps: 8 + Math.round(Math.random() * 4),
        rpe: 7 + Math.round(Math.random() * 2),
        technique: "standard",
      });
    }
  }
  return logs;
};

// ---------------------------------------------------------------------------
// Social / gamificação
// ---------------------------------------------------------------------------

export const demoRanking = [
  { id: "rk-01", gym_id: "1", week_start: "2026-08-10", student_id: "u1", rank_type: "load", points: 2450, load_kg: 18400, sessions: 12 },
  { id: "rk-02", gym_id: "1", week_start: "2026-08-10", student_id: "00000000-0000-0000-0000-000000000099", rank_type: "load", points: 1980, load_kg: 15200, sessions: 10 },
  { id: "rk-03", gym_id: "1", week_start: "2026-08-10", student_id: "u2", rank_type: "load", points: 1720, load_kg: 13100, sessions: 9 },
  { id: "rk-04", gym_id: "1", week_start: "2026-08-10", student_id: "u3", rank_type: "load", points: 1540, load_kg: 11800, sessions: 8 },
  { id: "rk-05", gym_id: "1", week_start: "2026-08-10", student_id: "u4", rank_type: "load", points: 1310, load_kg: 9800, sessions: 7 },
] as any[];

export const demoProfiles = [
  { id: "u1", gym_id: "1", role: "student", name: "Lucas Andrade", email: "lucas@gmail.com", avatar_url: "https://i.pravatar.cc/80?img=12", status: "active" },
  { id: "u2", gym_id: "1", role: "student", name: "Marina Costa", email: "marina@gmail.com", avatar_url: "https://i.pravatar.cc/80?img=45", status: "active" },
  { id: "u3", gym_id: "1", role: "student", name: "Pedro Rocha", email: "pedro@gmail.com", avatar_url: "https://i.pravatar.cc/80?img=15", status: "active" },
  { id: "u4", gym_id: "1", role: "student", name: "Ana Souza", email: "ana@gmail.com", avatar_url: "https://i.pravatar.cc/80?img=47", status: "active" },
] as any[];

// ---------------------------------------------------------------------------
// Diagnóstico rápido (checagem visual no dev)
// ---------------------------------------------------------------------------

export function demoSeedInfo() {
  return {
    equipment: demoEquipment.length,
    variations: Object.values(demoVariations).reduce((a, b) => a + b.length, 0),
    exercises: demoExercises.length,
    workoutDays: demoWorkoutDays.length,
    workoutExercises: demoWorkoutExercises.length,
    logs: demoWorkoutLogs().length,
    rankings: demoRanking.length,
  };
}
// ---------------------------------------------------------------------------
// BIBLIOTECA DE EXERCÍCIOS (modelagem Aparelho × Exercício)
// Categoria → Subcategoria → Exercícios. Peso livre não depende de aparelho.
// ---------------------------------------------------------------------------

export type DemoExercise = {
  id: string;
  name: string;
  picto: string;
  equipment: string | null;
  tags: string[];
  info: string;
  machineId?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbUrl?: string;
  videoUrlMale?: string;
  videoUrlFemale?: string;
};

export type DemoSubCategory = {
  id: string;
  name: string;
  exercises: DemoExercise[];
};

export type DemoCategory = {
  id: string;
  name: string;
  icon: string;
  subs: DemoSubCategory[];
};

const YT = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " execução")}`;

const UNSPLASH = (id: string) => `https://images.unsplash.com/${id}?w=300&h=300&fit=crop&q=70`;
// const VID_M = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"; // REPLACED WITH YOUTUBE SEARCH
// const VID_F = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"; // REPLACED WITH YOUTUBE SEARCH

const ex = (id: string, name: string, picto: string, info: string, equipment: string | null = null, tags: string[] = [], machineId?: string, thumbId = "photo-1517836357463-d25dfeac3438"): DemoExercise =>
  ({ id, name, picto, info, equipment, tags, machineId, imageUrl: UNSPLASH(thumbId), thumbUrl: UNSPLASH(thumbId), videoUrl: YT(name), videoUrlMale: YT(name), videoUrlFemale: YT(name) });

export const demoLib: DemoCategory[] = [
  {
    id: "peito", name: "Peito", icon: "💪",
    subs: [
      {
        id: "peito-geral", name: "Peitoral", exercises: [
          ex("lib-su1", "Supino Reto", "🏋️", "Deite no banco, pés firmes, barra na altura das axilas. Empurre sem travar o cotovelo.", "Supino Reto", [], "eq-demo-001"),
          ex("lib-su2", "Supino Inclinado", "🏋️", "Banco a 30–45°. Foco na porção clavicular do peitoral.", "Supino Reto", [], "eq-demo-001"),
          ex("lib-fl1", "Crucifixo com Halteres", "🦾", "Abra os braços lentamente até a linha do peito e volte fechando dos dois lados.", null, ["halter"]),
          ex("lib-pk1", "Voador (Peck Deck)", "🦾", "Sente com escápulas encostadas e aproxime os braços à frente do peito.", "Voador (Peck Deck)"),
        ],
      },
      { id: "peito-braco", name: "Peito + Tríceps", exercises: [
        ex("lib-par1", "Fundos (Paralelas)", "🤸", "Corpo vertical, desça até cotovelo a ~90° e suba com controle.", "Paralela", ["peso corporal"]),
        ex("lib-cr1", "Flexão de Braço", "🤸", "Corpo reto, cotovelos a 45° do tronco. Variação: joelhos no chão.", null, ["peso corporal"]),
      ] },
    ],
  },
  {
    id: "costas", name: "Costas", icon: "🦾",
    subs: [
      { id: "costas-dorsal", name: "Dorsal", exercises: [
        ex("lib-pu1", "Puxada Alta (Pulldown)", "⛰️", "Puxe a barra até a clavícula, cotovelos para baixo, sem balançar.", "Puxada Alta", [], "eq-demo-004"),
        ex("lib-pu2", "Pulldown Supinado", "⛰️", "Empunhadura invertida, foco na parte baixa do dorsal.", "Puxada Alta", [], "eq-demo-004"),
        ex("lib-bf1", "Barra Fixa", "🤾", "Puxe o queixo até acima da barra; faça negativa se precisar.", "Barra Fixa", ["peso corporal"]),
      ] },
      { id: "costas-romboid", name: "Trapézio / Romboides", exercises: [
        ex("lib-re1", "Remada Curvada", "🧗", "Tronco a ~45°, puxe a barra em direção ao abdômen.", "Remada Curvada / Baixa", [], "eq-demo-008"),
        ex("lib-re2", "Remada Baixa (Cabo)", "🧗", "Sentado, puxe a polia até a região do estômago, escápulas juntas.", "Remada Baixa", [], "eq-demo-008"),
      ] },
    ],
  },
  {
    id: "ombro", name: "Ombro", icon: "🏋️",
    subs: [
      { id: "ombro-deltoide", name: "Deltoide", exercises: [
        ex("lib-de1", "Desenvolvimento Militar", "🏋️", "Empurre a barra acima da cabeça, core firme, sem arco lombar.", "Desenvolvimento Militar"),
        ex("lib-el1", "Elevação Lateral", "🪶", "Levante os halteres até a linha dos ombros, cotovelos levemente flexionados.", null, ["halter"]),
        ex("lib-el2", "Elevação Frontal", "🪶", "Eleve um halter de cada vez até a altura dos olhos.", null, ["halter"]),
      ] },
    ],
  },
  {
    id: "biceps", name: "Bíceps", icon: "🩹",
    subs: [
      { id: "biceps-curto", name: "Bíceps", exercises: [
        ex("lib-ro1", "Rosca Direta", "🩹", "Cotovelos fixos ao tronco, suba a barra sem balançar o corpo.", null, ["barra", "halter"]),
        ex("lib-ro2", "Rosca Scott", "🩹", "Braços apoiados na banco Scott, amplitude sem travar.", "Rosca Scott"),
        ex("lib-ro3", "Rosca Concentrada", "🩹", "Coxa apoiando o cotovelo, controle total na subida.", null, ["halter"]),
      ] },
    ],
  },
  {
    id: "triceps", name: "Tríceps", icon: "🥓",
    subs: [
      { id: "triceps-longo", name: "Tríceps", exercises: [
        ex("lib-tr1", "Tríceps Pulley", "🥓", "Cotovelos fixos, puxe a polia até estender totalmente o braço.", "Tríceps Pulley", [], "eq-demo-010"),
        ex("lib-tr2", "Tríceps Testa", "🥓", "Deite no banco, flexione o antebraço atrás da cabeça e estenda.", null, ["barra", "halter"]),
        ex("lib-tr3", "Tríceps Corda", "🥓", "Cabo com corda, abra as pontas ao final do movimento.", null, ["cabo"]),
      ] },
    ],
  },
  {
    id: "antebraco", name: "Antebraço", icon: "🦾",
    subs: [
      { id: "antebraco-geral", name: "Antebraço / Punho", exercises: [
        ex("lib-ro4", "Rosca de Punho", "🖐️", "Antebraços apoiados, flexione o punho com a barra.", null, ["barra", "halter"]),
        ex("lib-ro5", "Rosca Inversa", "🖐️", "Empunhadura pronada, movimente apenas os punhos.", null, ["barra"]),
      ] },
    ],
  },
  {
    id: "inferiores", name: "Inferiores", icon: "🦵",
    subs: [
      { id: "inf-quadriceps", name: "Quadríceps", exercises: [
        ex("lib-ag1", "Agachamento no Smith", "🏋️", "Pés à frente da barra, desça até a coxa paralela ao chão.", "Agachamento Smith", [], "eq-demo-002"),
        ex("lib-ag2", "Leg Press 45°", "🦵", "Pés na largura dos ombros, desça mantendo lombar colada.", "Leg Press 45°", [], "eq-demo-003"),
        ex("lib-ag3", "Cadeira Extensora", "🦵", "Estenda as pernas até travar levemente, sem soltar o peso.", "Cadeira Extensora", [], "eq-demo-007"),
        ex("lib-ag4", "Agachamento Livre", "🏋️", "Barra nas costas, desça com controle; palma aberta.", null, ["barra"]),
      ] },
      { id: "inf-posterior", name: "Posterior", exercises: [
        ex("lib-mf1", "Mesa Flexora", "🦵", "Flexione as pernas levando o calcanhar em direção ao glúteo.", "Mesa Flexora", [], "eq-demo-009"),
        ex("lib-mf2", "Stiff", "🦵", "Quadril para trás, pernas semiflexionadas, sinta o posterior trabalhando."),
        ex("lib-mf3", "Bom Dia", "🦵", "Com barra nas costas, incline o tronco mantendo coluna neutra.", null, ["barra"]),
      ] },
      { id: "inf-gluteo", name: "Glúteos", exercises: [
        ex("lib-gl1", "Cadeira Abdutora", "🍑", "Afaste as pernas contra a resistência, controlando a volta.", "Cadeira Abdutora", [], "eq-demo-013"),
        ex("lib-gl2", "Agachamento Sumô", "🍑", "Pés bem abertos, desça ativando glúteo e adutores."),
        ex("lib-gl3", "Elevação Pélvica", "🍑", "Deite de costas, suba o quadril apertando o glúteo no topo.", null, ["peso corporal"]),
      ] },
      { id: "inf-panturrilha", name: "Panturrilha", exercises: [
        ex("lib-pa1", "Panturrilha em Pé", "🦶", "Suba na ponta dos pés com peso, segure 1s no topo.", "Panturrilha em Pé"),
        ex("lib-pa2", "Panturrilha Sentado", "🦶", "Joelhos a 90°, eleve os calcanhares com peso sobre as coxas.", null, ["halter"]),
      ] },
    ],
  },
  {
    id: "abdomen", name: "Abdômen / Core", icon: "🔥",
    subs: [
      { id: "abd-superior", name: "Abdômen", exercises: [
        ex("lib-ab1", "Abdominal na Máquina", "🔥", "Encoste a parte superior na almofada e faça a flexão sem puxar a cabeça.", "Abdominal (Máquina)"),
        ex("lib-ab2", "Crunch no Solo", "🔥", "Lombar colada no chão, olhe para o teto ao subir.", null, ["peso corporal"]),
        ex("lib-ab3", "Prancha Isométrica", "🔥", "Corpo reto, ative o core e sustente o tempo proposto.", null, ["peso corporal"]),
      ] },
      { id: "abd-infra", name: "Infra / Oblíquos", exercises: [
        ex("lib-ab4", "Elevação de Perna (Infra)", "🔥", "Pendure-se ou apoie-se, eleve as pernas controlando o core.", null, ["peso corporal"]),
        ex("lib-ab5", "Prancha Lateral", "🔥", "Apoie o cotovelo, mantenha o quadril alinhado.", null, ["peso corporal"]),
      ] },
    ],
  },
  {
    id: "cardio", name: "Cardio", icon: "🏃",
    subs: [
      { id: "cardio-maquinas", name: "Máquinas", exercises: [
        ex("lib-es1", "Esteira", "🏃", "Comece leve e aumente a inclinação 1 a 1 a cada 2 min.", "Esteira Elétrica", [], "eq-demo-005"),
        ex("lib-bi1", "Bicicleta Ergométrica", "🚴", "Cadência confortável, ajuste a resistência por percepção.", "Bicicleta Ergométrica", [], "eq-demo-006"),
        ex("lib-ell", "Elíptico", "🚶", "Movimento contínuo, empurre com os calcanhares.", "Elíptico"),
        ex("lib-row", "Remador", "🚣", "Empurre com as pernas, depois puxe com os braços; solte na ordem inversa.", "Remador"),
      ] },
      { id: "cardio-hiit", name: "HIIT / Funcional", exercises: [
        ex("lib-bur", "Burpee", "🤸", "Flexão → impulso → salto com as mãos acima da cabeça.", null, ["peso corporal"]),
        ex("lib-crd", "Pular Corda", "🪢", "Pulos rápidos, aterrisse suave na ponta dos pés.", null, ["corda"]),
        ex("lib-kett", "Swing de Kettlebell", "🪨", "Balanço pélvico empurrando o kettlebell à frente até a altura do peito.", null, ["kettlebell"]),
      ] },
    ],
  },
  {
    id: "alongamento", name: "Alongamento", icon: "🧘",
    subs: [
      { id: "along-geral", name: "Flexibilidade / Mobilidade", exercises: [
        ex("lib-yl1", "Alongamento de Posterior", "🧘", "Sentado, alcance os pés mantendo a coluna alongada.", null, ["peso corporal"]),
        ex("lib-yl2", "Quadril (Borboleta)", "🧘", "Plantas dos pés juntas, puxe os calcanhares para perto do corpo."),
        ex("lib-yl3", "Mobilidade de Ombro", "🧘", "Gire os braços lentamente, aumentando a amplitude aos poucos."),
      ] },
    ],
  },
];

export function demoLibCategory(catId: string): DemoCategory | undefined {
  return demoLib.find((c) => c.id === catId);
}


/** Sessões de aparelho em aberto agora (fonte real: equipment_sessions active). */
export function demoOpenSessions() {
  return [
    { id: "os-1", student_name: "Pedro Rocha", equipment_name: "Leg Press 45°", started_at: new Date(Date.now() - 145 * 60000).toISOString() },
    { id: "os-2", student_name: "Ana Souza", equipment_name: "Supino Reto", started_at: new Date(Date.now() - 40 * 60000).toISOString() },
  ];
}
