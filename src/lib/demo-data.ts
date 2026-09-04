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
  { id: "eq-demo-001", gym_id: "00000000-0000-0000-0000-000000000001", name: "Supino Reto", category: "strength", capacity: 8, status: "available", nfc_tag_url: "gym://eq/001", qr_url: "EQ001", map_position: { x: 12, y: 18 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-002", gym_id: "00000000-0000-0000-0000-000000000001", name: "Agachamento Smith", category: "strength", capacity: 6, status: "available", nfc_tag_url: "gym://eq/002", qr_url: "EQ002", map_position: { x: 30, y: 14 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-003", gym_id: "00000000-0000-0000-0000-000000000001", name: "Leg Press 45°", category: "strength", capacity: 10, status: "available", nfc_tag_url: "gym://eq/003", qr_url: "EQ003", map_position: { x: 50, y: 20 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-004", gym_id: "00000000-0000-0000-0000-000000000001", name: "Puxada Alta", category: "strength", capacity: 6, status: "available", nfc_tag_url: "gym://eq/004", qr_url: "EQ004", map_position: { x: 70, y: 12 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-005", gym_id: "00000000-0000-0000-0000-000000000001", name: "Esteira Elétrica", category: "cardio", capacity: 6, status: "available", nfc_tag_url: "gym://eq/005", qr_url: "EQ005", map_position: { x: 88, y: 24 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-006", gym_id: "00000000-0000-0000-0000-000000000001", name: "Bicicleta Ergométrica", category: "cardio", capacity: 8, status: "in_use", nfc_tag_url: "gym://eq/006", qr_url: "EQ006", map_position: { x: 88, y: 40 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-007", gym_id: "00000000-0000-0000-0000-000000000001", name: "Cadeira Extensora", category: "strength", capacity: 6, status: "available", nfc_tag_url: "gym://eq/007", qr_url: "EQ007", map_position: { x: 22, y: 34 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-008", gym_id: "00000000-0000-0000-0000-000000000001", name: "Remada Curvada / Baixa", category: "strength", capacity: 6, status: "maintenance", nfc_tag_url: null, qr_url: "EQ008", map_position: { x: 45, y: 42 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-009", gym_id: "00000000-0000-0000-0000-000000000001", name: "Mesa Flexora", category: "strength", capacity: 6, status: "available", nfc_tag_url: "gym://eq/009", qr_url: "EQ009", map_position: { x: 62, y: 38 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-010", gym_id: "00000000-0000-0000-0000-000000000001", name: "Crossover / Polia", category: "strength", capacity: 4, status: "available", nfc_tag_url: "gym://eq/010", qr_url: "EQ010", map_position: { x: 78, y: 50 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-011", gym_id: "00000000-0000-0000-0000-000000000001", name: "Desenvolvimento Militar", category: "strength", capacity: 5, status: "available", nfc_tag_url: "gym://eq/011", qr_url: "EQ011", map_position: { x: 35, y: 28 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-012", gym_id: "00000000-0000-0000-0000-000000000001", name: "Rosca Scott", category: "strength", capacity: 4, status: "available", nfc_tag_url: "gym://eq/012", qr_url: "EQ012", map_position: { x: 55, y: 32 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-013", gym_id: "00000000-0000-0000-0000-000000000001", name: "Cadeira Abdutora", category: "strength", capacity: 4, status: "available", nfc_tag_url: "gym://eq/013", qr_url: "EQ013", map_position: { x: 15, y: 50 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-014", gym_id: "00000000-0000-0000-0000-000000000001", name: "Panturrilha em Pé", category: "strength", capacity: 4, status: "available", nfc_tag_url: "gym://eq/014", qr_url: "EQ014", map_position: { x: 82, y: 46 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-015", gym_id: "00000000-0000-0000-0000-000000000001", name: "Barra Fixa", category: "strength", capacity: 4, status: "available", nfc_tag_url: null, qr_url: "EQ015", map_position: { x: 68, y: 28 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-016", gym_id: "00000000-0000-0000-0000-000000000001", name: "Elíptico", category: "cardio", capacity: 5, status: "available", nfc_tag_url: "gym://eq/016", qr_url: "EQ016", map_position: { x: 92, y: 32 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-017", gym_id: "00000000-0000-0000-0000-000000000001", name: "Remador", category: "cardio", capacity: 5, status: "available", nfc_tag_url: "gym://eq/017", qr_url: "EQ017", map_position: { x: 92, y: 48 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "eq-demo-018", gym_id: "00000000-0000-0000-0000-000000000001", name: "Abdominal (Máquina)", category: "strength", capacity: 4, status: "available", nfc_tag_url: "gym://eq/018", qr_url: "EQ018", map_position: { x: 42, y: 56 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
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
  { id: "ex-demo-001", name: "Supino Reto", category: "strength", muscles: ["chest"], tips: ["Mantenha escápulas retraídas"], technique_default: "standard", high_impact: false, photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/supino-reto.webp?v=2" },
  { id: "ex-demo-002", name: "Agachamento", category: "strength", muscles: ["legs"], tips: ["Joelhos acompanham os pés"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-livre.webp?v=2" },
  { id: "ex-demo-003", name: "Crucifixo com Halteres", category: "strength", muscles: ["chest"], tips: ["Abra até a linha do peito"], technique_default: "standard", high_impact: false, photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/crucifixo-com-halteres.webp?v=2" },
  { id: "ex-demo-004", name: "Desenvolvimento Militar", category: "strength", muscles: ["shoulders"], tips: ["Core firme, sem arco lombar"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/desenvolvimento-militar.webp?v=2" },
  { id: "ex-demo-005", name: "Puxada Alta", category: "strength", muscles: ["back"], tips: ["Puxe com cotovelos baixos"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/puxada-alta.webp?v=2" },
  { id: "ex-demo-006", name: "Esteira", category: "cardio", muscles: ["legs"], tips: ["Comece em ritmo leve"], technique_default: "standard", high_impact: true, photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/esteira.webp?v=2" },
  { id: "ex-demo-007", name: "Rosca Direta", category: "strength", muscles: ["biceps"], tips: ["Sem balançar o tronco"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-direta.webp?v=2" },
  { id: "ex-demo-008", name: "Tríceps Corda", category: "strength", muscles: ["triceps"], tips: ["Cotovelos fixos, abra as pontas"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-corda.webp?v=2" },
  { id: "ex-demo-009", name: "Leg Press 45°", category: "strength", muscles: ["legs"], tips: ["Lombar colada no banco"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/leg-press-45.webp?v=2" },
  { id: "ex-demo-010", name: "Prancha Isométrica", category: "strength", muscles: ["core"], tips: ["Corpo reto, ative o core"], technique_default: "standard", high_impact: false , photo_url: "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/prancha-isometrica.webp?v=2" },
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
  we(2, "ex-demo-003", 3, "12", 60), // Crucifixo com Halteres
  we(3, "ex-demo-004", 3, "10", 75), // Desenvolvimento Militar
  we(4, "ex-demo-005", 4, "10", 75), // Puxada Alta
  we(5, "ex-demo-007", 3, "12", 45), // Rosca Direta
  we(6, "ex-demo-008", 3, "15", 45), // Tríceps Corda
  we(7, "ex-demo-002", 4, "8", 90),  // Agachamento
  we(8, "ex-demo-009", 3, "12", 60), // Leg Press 45°
  we(9, "ex-demo-010", 3, "45s", 30), // Prancha Isométrica
  we(10, "ex-demo-006", 1, "15min", 0), // Esteira (finalizador)
] as any[];

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
  { id: "u1", gym_id: "1", role: "student", name: "Lucas Andrade", email: "lucas@gmail.com", avatar_url: null, status: "active" },
  { id: "u2", gym_id: "1", role: "student", name: "Marina Costa", email: "marina@gmail.com", avatar_url: null, status: "active" },
  { id: "u3", gym_id: "1", role: "student", name: "Pedro Rocha", email: "pedro@gmail.com", avatar_url: null, status: "active" },
  { id: "u4", gym_id: "1", role: "student", name: "Ana Souza", email: "ana@gmail.com", avatar_url: null, status: "active" },
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
  imageUrl?: string | null;
  videoUrl?: string;
  thumbUrl?: string | null;
  videoUrlMale?: string | null;
  videoUrlFemale?: string | null;
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

// const VID_M = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"; // REPLACED WITH YOUTUBE SEARCH
// const VID_F = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"; // REPLACED WITH YOUTUBE SEARCH

const ex = (id: string, name: string, picto: string, info: string, equipment: string | null = null, tags: string[] = [], machineId?: string): DemoExercise =>
  ({ id, name, picto, info, equipment, tags, machineId, imageUrl: null, thumbUrl: null, videoUrl: YT(name), videoUrlMale: YT(name), videoUrlFemale: YT(name) });

/* Imagens reais por exercício · Storage do projeto (WebP 400px, sem hotlink).
   Pipeline: scripts/fetch-exercise-images.mjs + upload (ver docs do lote). */
export const EXERCISE_PHOTO_OVERRIDES: Record<string, string> = {
  "lib-af1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/afundo.webp?v=2",
  "lib-ag3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-frontal.webp?v=2",
  "lib-ag2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-livre.webp?v=2",
  "lib-ag1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-smith.webp?v=2",
  "lib-ag4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-sumo.webp?v=2",
  "lib-bf1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/barra-fixa.webp?v=2",
  "lib-bf2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/barra-fixa-pronada.webp?v=2",
  "lib-bf3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/barra-fixa-supinada.webp?v=2",
  "lib-bd1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/bom-dia.webp?v=2",
  "lib-gl1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/cadeira-abdutora.webp?v=2",
  "lib-ce1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/cadeira-extensora.webp?v=2",
  "lib-mf2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/cadeira-flexora.webp?v=2",
  "lib-fl1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/crucifixo-com-halteres.webp?v=2",
  "lib-fl2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/crucifixo-polia.webp?v=2",
  "lib-ab3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/crunch-polia-alta.webp?v=2",
  "lib-ab2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/crunch-solo.webp?v=2",
  "lib-de3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/desenvolvimento-arnold.webp?v=2",
  "lib-de2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/desenvolvimento-com-halteres.webp?v=2",
  "lib-de1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/desenvolvimento-militar.webp?v=2",
  "lib-ab6": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/elevacao-de-perna-infra.webp?v=2",
  "lib-el2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/elevacao-frontal.webp?v=2",
  "lib-el1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/elevacao-lateral.webp?v=2",
  "lib-gl2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/elevacao-pelvica.webp?v=2",
  "lib-cr1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/flexao-de-braco.webp?v=2",
  "lib-par1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/fundos-paralelas.webp?v=2",
  "lib-gl3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/hip-thrust.webp?v=2",
  "lib-hd1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/hiperextensao-lombar.webp?v=2",
  "lib-gl5": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/kickback.webp?v=2",
  "lib-lp1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/leg-press-45.webp?v=2",
  "lib-lp2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/leg-press-pes-altos.webp?v=2",
  "lib-lp3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/leg-press-unilateral.webp?v=2",
  "lib-tr6": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/mergulho-paralelas.webp?v=2",
  "lib-mf1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/mesa-flexora.webp?v=2",
  "lib-pa1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/panturrilha-em-pe.webp?v=2",
  "lib-pa2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/panturrilha-no-leg-press.webp?v=2",
  "lib-pa3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/panturrilha-sentado.webp?v=2",
  "lib-gl4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/passada.webp?v=2",
  "lib-ab7": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/prancha-lateral.webp?v=2",
  "lib-pu3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/pulldown-supinado.webp?v=2",
  "lib-pu1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/puxada-alta.webp?v=2",
  "lib-pu2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/puxada-alta-fechada.webp?v=2",
  "lib-pu4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/puxada-triangulo.webp?v=2",
  "lib-re2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/remada-baixa.webp?v=2",
  "lib-re1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/remada-curvada.webp?v=2",
  "lib-re5": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/remada-na-polia.webp?v=2",
  "lib-ro2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-alternada.webp?v=2",
  "lib-ro4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-concentrada.webp?v=2",
  "lib-ro1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-direta.webp?v=2",
  "lib-ro9": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-inversa.webp?v=2",
  "lib-ro5": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-martelo.webp?v=2",
  "lib-ro6": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-na-polia-baixa.webp?v=2",
  "lib-ro3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-scott.webp?v=2",
  "lib-sh1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/shrugg.webp?v=2",
  "lib-st1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/stiff.webp?v=2",
  "lib-su4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/supino-com-halteres.webp?v=2",
  "lib-su3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/supino-declinado.webp?v=2",
  "lib-su2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/supino-inclinado.webp?v=2",
  "lib-su1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/supino-reto.webp?v=2",
  "lib-tr3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-corda.webp?v=2",
  "lib-tr4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-frances.webp?v=2",
  "lib-tr5": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-maquina.webp?v=2",
  "lib-tr1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-pulley.webp?v=2",
  "lib-tr2": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/triceps-testa.webp?v=2",
  "lib-pk1": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/voador-peck-deck.webp?v=2",  "lib-re3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/remada-unilateral.webp?v=2",
  "lib-re4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/remada-cavalinho.webp?v=2",
  "lib-ro7": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/rosca-21.webp?v=2",
  "lib-ag5": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/agachamento-bulgaro.webp?v=2",
  "lib-de4": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/desenvolvimento-na-maquina.webp?v=2",
  "lib-el3": "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/public/exercise-images/elevacao-lateral-polia.webp?v=2",
};

import { applyExpandedLibrary } from "./demo-library-expanded";

export const demoLib: DemoCategory[] = [
  {
    id: "peito", name: "Peito", icon: "chest",
    subs: [
      {
        id: "peito-geral", name: "Peitoral", exercises: [
          ex("lib-su1", "Supino Reto", "chest", "Deite no banco, pés firmes, barra na altura das axilas. Empurre sem travar o cotovelo.", "Supino Reto", ["barra"], "eq-demo-001"),
          ex("lib-su2", "Supino Inclinado", "chest-incline", "Banco a 30–45°. Foco na porção clavicular do peitoral.", "Supino Reto", ["barra"], "eq-demo-001"),
          ex("lib-su3", "Supino Declinado", "chest-decline", "Banco declinado, foco na porção esternal/inferior do peitoral.", "Supino Reto", ["barra"], "eq-demo-001"),
          ex("lib-su4", "Supino com Halteres", "chest", "Maior amplitude e ativação de estabilizadores.", "Supino Reto", ["halter"], "eq-demo-001"),
          ex("lib-fl1", "Crucifixo com Halteres", "chest-fly", "Abra os braços lentamente até a linha do peito e volte fechando dos dois lados.", null, ["halter"]),
          ex("lib-fl2", "Crucifixo na Polia Baixa", "cable", "Cruze os braços à frente do peito, mantendo leve flexão de cotovelo.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
          ex("lib-pk1", "Voador (Peck Deck)", "chest-fly", "Sente com escápulas encostadas e aproxime os braços à frente do peito.", "Voador (Peck Deck)", ["máquina"]),
          ex("lib-cr1", "Flexão de Braço", "chest", "Corpo reto, cotovelos a 45° do tronco. Variação: joelhos no chão.", null, ["peso corporal"]),
          ex("lib-par1", "Fundos (Paralelas)", "chest", "Corpo vertical, desça até cotovelo a ~90° e suba com controle.", "Paralela", ["peso corporal"]),
        ],
      },
    ],
  },
  {
    id: "costas", name: "Costas", icon: "back",
    subs: [
      { id: "costas-dorsal", name: "Dorsal", exercises: [
        ex("lib-pu1", "Puxada Alta Aberta", "back-lat", "Puxe a barra até a clavícula, cotovelos para baixo, sem balançar.", "Puxada Alta", ["máquina"], "eq-demo-004"),
        ex("lib-pu2", "Puxada Alta Fechada", "back-lat", "Maior ênfase no meio das costas e bíceps.", "Puxada Alta", ["máquina"], "eq-demo-004"),
        ex("lib-pu3", "Pulldown Supinado", "back-lat", "Empunhadura invertida, foco na parte baixa do dorsal.", "Puxada Alta", ["máquina"], "eq-demo-004"),
        ex("lib-pu4", "Puxada com Triângulo", "back-lat", "Cotovelos junto ao corpo, puxe até o esterno.", "Puxada Alta", ["máquina"], "eq-demo-004"),
        ex("lib-bf1", "Barra Fixa", "pullup", "Puxe o queixo até acima da barra; faça negativa se precisar.", "Barra Fixa", ["peso corporal"], "eq-demo-015"),
        ex("lib-bf2", "Barra Fixa Pronada", "pullup", "Maior ênfase no dorsal e no meio das costas.", "Barra Fixa", ["peso corporal"], "eq-demo-015"),
        ex("lib-bf3", "Barra Fixa Supinada", "pullup", "Maior ativação de bíceps junto com o dorsal.", "Barra Fixa", ["peso corporal"], "eq-demo-015"),
      ] },
      { id: "costas-espessura", name: "Espessura / Meio das Costas", exercises: [
        ex("lib-re1", "Remada Curvada", "back-row", "Tronco a ~45°, puxe a barra em direção ao abdômen.", "Remada Curvada / Baixa", ["barra"], "eq-demo-008"),
        ex("lib-re2", "Remada Baixa (Cabo)", "back-row", "Sentado, puxe a polia até a região do estômago, escápulas juntas.", "Remada Curvada / Baixa", ["cabo"], "eq-demo-008"),
        ex("lib-re3", "Remada Unilateral", "back-row", "Apoie uma mão e um joelho no banco, puxe o halter em direção ao quadril.", null, ["halter"]),
        ex("lib-re4", "Remada Cavalinho", "back-row", "Apoio no banco inclinado, puxe os halters em direção ao abdômen.", "Remada Curvada / Baixa", ["halter"], "eq-demo-008"),
        ex("lib-re5", "Remada na Polia Baixa", "back-row", "Puxe a barra em direção ao abdômen, cotovelos perto do corpo.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
        ex("lib-sh1", "Shrugg", "back", "Eleve os ombros em direção às orelhas, segurando halteres ou barra.", null, ["barra", "halter"]),
      ] },
    ],
  },
  {
    id: "ombro", name: "Ombro", icon: "shoulder",
    subs: [
      { id: "ombro-deltoide", name: "Deltoide", exercises: [
        ex("lib-de1", "Desenvolvimento Militar", "shoulder-press", "Empurre a barra acima da cabeça, core firme, sem arco lombar.", "Desenvolvimento Militar", ["barra"], "eq-demo-011"),
        ex("lib-de2", "Desenvolvimento com Halteres", "shoulder-press", "Maior amplitude e controle de cada lado.", "Desenvolvimento Militar", ["halter"], "eq-demo-011"),
        ex("lib-de3", "Desenvolvimento Arnold", "shoulder-press", "Rotação dos punhos durante a subida.", null, ["halter"]),
        ex("lib-el1", "Elevação Lateral", "shoulder-lateral", "Levante os halteres até a linha dos ombros, cotovelos levemente flexionados.", null, ["halter"]),
        ex("lib-el2", "Elevação Frontal", "shoulder-lateral", "Eleve um halter de cada vez até a altura dos olhos.", null, ["halter"]),
        ex("lib-el3", "Elevação Lateral na Polia", "cable", "Cotovelo levemente flexionado, abra o braço lateralmente.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
        ex("lib-de4", "Desenvolvimento na Máquina", "shoulder-press", "Movimento guiado, bom para iniciantes.", "Desenvolvimento Militar", ["máquina"], "eq-demo-011"),
      ] },
    ],
  },
  {
    id: "biceps", name: "Bíceps", icon: "biceps",
    subs: [
      { id: "biceps-curto", name: "Bíceps", exercises: [
        ex("lib-ro1", "Rosca Direta", "biceps-curl", "Cotovelos fixos ao tronco, suba a barra sem balançar o corpo.", null, ["barra"]),
        ex("lib-ro2", "Rosca Alternada", "biceps-curl", "Suba um braço de cada vez, controlegem a descida.", null, ["halter"]),
        ex("lib-ro3", "Rosca Scott", "biceps-curl", "Braços apoiados no banco Scott, amplitude sem travar.", "Rosca Scott", ["barra"], "eq-demo-012"),
        ex("lib-ro4", "Rosca Concentrada", "biceps-curl", "Coxa apoiando o cotovelo, controle total na subida.", null, ["halter"]),
        ex("lib-ro5", "Rosca Martelo", "hammer-curl", "Empunhadura neutra, trabalha braquial e antebraço.", null, ["halter"]),
        ex("lib-ro6", "Rosca na Polia Baixa", "cable", "Cotovelos fixos junto ao corpo, puxe a barra para cima.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
        ex("lib-ro7", "Rosca 21", "biceps-curl", "7 reps na metade inferior, 7 na metade superior, 7 completas.", null, ["barra", "halter"]),
      ] },
    ],
  },
  {
    id: "triceps", name: "Tríceps", icon: "triceps",
    subs: [
      { id: "triceps-longo", name: "Tríceps", exercises: [
        ex("lib-tr1", "Tríceps Pulley", "triceps-pushdown", "Cotovelos fixos, puxe a polia até estender totalmente o braço.", "Tríceps Pulley", ["cabo"], "eq-demo-010"),
        ex("lib-tr2", "Tríceps Testa", "triceps-extension", "Deite no banco, flexione o antebraço atrás da cabeça e estenda.", null, ["barra", "halter"]),
        ex("lib-tr3", "Tríceps Corda", "triceps-pushdown", "Cabo com corda, abra as pontas ao final do movimento.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
        ex("lib-tr4", "Tríceps Francês", "triceps-extension", "Acima da cabeça, desça o peso atrás da nuca com controle.", null, ["halter"]),
        ex("lib-tr5", "Tríceps Máquina", "triceps-pushdown", "Movimento guiado, bom para isolar o tríceps.", "Tríceps Pulley", ["máquina"], "eq-demo-010"),
        ex("lib-tr6", "Mergulho (Paralelas)", "triceps-pushdown", "Corpo reto, cotovelos para trás, desça até ~90°.", "Paralela", ["peso corporal"]),
      ] },
    ],
  },
  {
    id: "antebraco", name: "Antebraço", icon: "forearm",
    subs: [
      { id: "antebraco-geral", name: "Antebraço / Punho", exercises: [
        ex("lib-ro8", "Rosca de Punho", "forearm-wrist", "Antebraços apoiados, flexione o punho com a barra.", null, ["barra", "halter"]),
        ex("lib-ro9", "Rosca Inversa", "forearm-wrist", "Empunhadura pronada, movimente apenas os punhos.", null, ["barra"]),
        ex("lib-ro10", "Extensão de Punho", "forearm-wrist", "Antebraços apoiados, estenda os punhos contra a resistência.", null, ["barra", "halter"]),
        ex("lib-ro11", "Farmer Walk", "forearm", "Segure halteres pesados e caminhe mantendo postura.", null, ["halter"]),
      ] },
    ],
  },
  {
    id: "inferiores", name: "Inferiores", icon: "legs",
    subs: [
      { id: "inf-quadriceps", name: "Quadríceps", exercises: [
        ex("lib-ag1", "Agachamento no Smith", "legs-squat", "Pés à frente da barra, desça até a coxa paralela ao chão.", "Agachamento Smith", ["máquina"], "eq-demo-002"),
        ex("lib-ag2", "Agachamento Livre", "legs-squat", "Barra nas costas, desça com controle; palma aberta.", null, ["barra"]),
        ex("lib-ag3", "Agachamento Frontal", "legs-squat", "Barra apoiada nos ombros frontais, core firme.", null, ["barra"]),
        ex("lib-ag4", "Agachamento Sumô", "legs-squat", "Pés bem abertos, desça ativando glúteo e adutores.", null, ["barra", "halter"]),
        ex("lib-ag5", "Agachamento Búlgaro", "legs-squat", "Um pé atrás no banco, desça com o pé da frente.", null, ["halter"]),
        ex("lib-lp1", "Leg Press 45°", "legs-press", "Pés na largura dos ombros, desça mantendo lombar colada.", "Leg Press 45°", ["máquina"], "eq-demo-003"),
        ex("lib-lp2", "Leg Press Pés Altos", "legs-press", "Maior ênfase no posterior e glúteo.", "Leg Press 45°", ["máquina"], "eq-demo-003"),
        ex("lib-lp3", "Leg Press Unilateral", "legs-press", "Trabalhe uma perna por vez para corrigir desequilíbrios.", "Leg Press 45°", ["máquina"], "eq-demo-003"),
        ex("lib-ce1", "Cadeira Extensora", "legs-extension", "Estenda as pernas até travar levemente, sem soltar o peso.", "Cadeira Extensora", ["máquina"], "eq-demo-007"),
        ex("lib-af1", "Afundo", "legs-squat", "Dê um passo à frente e desça até o joelho traseiro quase tocar o chão.", null, ["peso corporal", "halter"]),
      ] },
      { id: "inf-posterior", name: "Posterior", exercises: [
        ex("lib-mf1", "Mesa Flexora", "hamstrings-curl", "Flexione as pernas levando o calcanhar em direção ao glúteo.", "Mesa Flexora", ["máquina"], "eq-demo-009"),
        ex("lib-mf2", "Cadeira Flexora", "hamstrings-curl", "Movimento guiado, controle a fase excêntrica.", "Mesa Flexora", ["máquina"], "eq-demo-009"),
        ex("lib-st1", "Stiff", "stiff", "Quadril para trás, pernas semiflexionadas, sinta o posterior trabalhando.", null, ["barra", "halter"]),
        ex("lib-bd1", "Bom Dia", "stiff", "Com barra nas costas, incline o tronco mantendo coluna neutra.", null, ["barra"]),
        ex("lib-hd1", "Hiperextensão Lombar", "back", "Máquina de hiperextensão, estenda o tronco com controle.", null, ["máquina"]),
      ] },
      { id: "inf-gluteo", name: "Glúteos", exercises: [
        ex("lib-gl1", "Cadeira Abdutora", "glutes-abductor", "Afaste as pernas contra a resistência, controlando a volta.", "Cadeira Abdutora", ["máquina"], "eq-demo-013"),
        ex("lib-gl2", "Elevação Pélvica", "glutes-hip", "Deite de costas, suba o quadril apertando o glúteo no topo.", null, ["peso corporal", "barra"]),
        ex("lib-gl3", "Hip Thrust", "glutes-hip", "Costas apoiadas no banco, empurre o peso com os glúteos.", null, ["barra"]),
        ex("lib-gl4", "Passada", "glutes-hip", "Passo longo à frente, empurre pelo calcanhar.", null, ["peso corporal", "halter"]),
        ex("lib-gl5", "Kickback", "glutes-hip", "Apoie as mãos e um joelho, estenda a perna para trás.", null, ["peso corporal"]),
      ] },
      { id: "inf-panturrilha", name: "Panturrilha", exercises: [
        ex("lib-pa1", "Panturrilha em Pé", "calves-standing", "Suba na ponta dos pés com peso, segure 1s no topo.", "Panturrilha em Pé", ["máquina"], "eq-demo-014"),
        ex("lib-pa2", "Panturrilha no Leg Press", "calves-standing", "Pés na ponta da plataforma, eleve os calcanhares.", "Leg Press 45°", ["máquina"], "eq-demo-003"),
        ex("lib-pa3", "Panturrilha Sentado", "calves-seated", "Joelhos a 90°, eleve os calcanhares com peso sobre as coxas.", null, ["halter", "máquina"]),
        ex("lib-pa4", "Panturrilha em Pé Unilateral", "calves-standing", "Um pé por vez, maior amplitude e controle.", null, ["peso corporal"]),
      ] },
    ],
  },
  {
    id: "abdomen", name: "Abdômen / Core", icon: "abs",
    subs: [
      { id: "abd-superior", name: "Abdômen", exercises: [
        ex("lib-ab1", "Abdominal na Máquina", "abs-crunch", "Encoste a parte superior na almofada e faça a flexão sem puxar a cabeça.", "Abdominal (Máquina)", ["máquina"], "eq-demo-018"),
        ex("lib-ab2", "Crunch no Solo", "abs-crunch", "Lombar colada no chão, olhe para o teto ao subir.", null, ["peso corporal"]),
        ex("lib-ab3", "Crunch na Polia Alta", "cable", "Puxe a corda flexionando o tronco.", "Crossover / Polia", ["cabo"], "eq-demo-010"),
        ex("lib-ab4", "Prancha Isométrica", "abs-plank", "Corpo reto, ative o core e sustente o tempo proposto.", null, ["peso corporal"]),
        ex("lib-ab5", "Prancha com Elevação de Perna", "abs-plank", "Mantenha a prancha e eleve uma perna de cada vez.", null, ["peso corporal"]),
      ] },
      { id: "abd-infra", name: "Infra / Oblíquos", exercises: [
        ex("lib-ab6", "Elevação de Perna (Infra)", "abs-crunch", "Pendure-se ou apoie-se, eleve as pernas controlando o core.", null, ["peso corporal"]),
        ex("lib-ab7", "Prancha Lateral", "abs-plank", "Apoie o cotovelo, mantenha o quadril alinhado.", null, ["peso corporal"]),
        ex("lib-ab8", "Russian Twist", "abs-crunch", "Rotação do tronco com halter ou peso corporal.", null, ["halter", "peso corporal"]),
        ex("lib-ab9", "Bicicleta no Solo", "abs-crunch", "Rotação alternada de cotovelo e joelho oposto.", null, ["peso corporal"]),
        ex("lib-ab10", "Mountain Climber", "abs-crunch", "Posição de prancha, traga os joelhos em direção ao peito alternadamente.", null, ["peso corporal"]),
      ] },
    ],
  },
  {
    id: "cardio", name: "Cardio", icon: "cardio",
    subs: [
      { id: "cardio-maquinas", name: "Máquinas", exercises: [
        ex("lib-es1", "Esteira", "run", "Comece leve e aumente a inclinação 1 a 1 a cada 2 min.", "Esteira Elétrica", ["máquina"], "eq-demo-005"),
        ex("lib-bi1", "Bicicleta Ergométrica", "bike", "Cadência confortável, ajuste a resistência por percepção.", "Bicicleta Ergométrica", ["máquina"], "eq-demo-006"),
        ex("lib-ell", "Elíptico", "cardio", "Movimento contínuo, empurre com os calcanhares.", "Elíptico", ["máquina"], "eq-demo-016"),
        ex("lib-row", "Remador", "rower", "Empurre com as pernas, depois puxe com os braços; solte na ordem inversa.", "Remador", ["máquina"], "eq-demo-017"),
      ] },
      { id: "cardio-hiit", name: "HIIT / Funcional", exercises: [
        ex("lib-bur", "Burpee", "cardio", "Flexão → impulso → salto com as mãos acima da cabeça.", null, ["peso corporal"]),
        ex("lib-crd", "Pular Corda", "cardio", "Pulos rápidos, aterrisse suave na ponta dos pés.", null, ["corda"]),
        ex("lib-kett", "Swing de Kettlebell", "cardio", "Balanço pélvico empurrando o kettlebell à frente até a altura do peito.", null, ["kettlebell"]),
        ex("lib-box", "Box Jump", "cardio", "Salto em cima do box com amortecimento suave.", null, ["box"]),
        ex("lib-spr", "Sprint na Esteira", "run", "Corridas curtas e intensas com intervalo de recuperação.", "Esteira Elétrica", ["máquina"], "eq-demo-005"),
      ] },
    ],
  },
  {
    id: "alongamento", name: "Alongamento", icon: "abs",
    subs: [
      { id: "along-geral", name: "Flexibilidade / Mobilidade", exercises: [
        ex("lib-yl1", "Alongamento de Posterior", "legs", "Sentado, alcance os pés mantendo a coluna alongada.", null, ["peso corporal"]),
        ex("lib-yl2", "Quadril (Borboleta)", "legs", "Plantas dos pés juntas, puxe os calcanhares para perto do corpo.", null, ["peso corporal"]),
        ex("lib-yl3", "Mobilidade de Ombro", "shoulder", "Gire os braços lentamente, aumentando a amplitude aos poucos.", null, ["peso corporal"]),
        ex("lib-yl4", "Alongamento de Peito", "chest", "Apoie o braço estendido na parede e rotacione o tronco.", null, ["peso corporal"]),
        ex("lib-yl5", "Gato e Vaca", "abs", "Movimento lento de flexão e extensão lombar em quadrupedia.", null, ["peso corporal"]),
      ] },
    ],
  },
];

// aplica as imagens reais do Storage sobre os placeholders genéricos
for (const cat of demoLib) {
  for (const sub of cat.subs) {
    for (const ex of sub.exercises) {
      const photo = EXERCISE_PHOTO_OVERRIDES[ex.id];
      if (photo) {
        ex.imageUrl = photo;
        ex.thumbUrl = photo;
      }
    }
  }
}

// biblioteca expandida: acervo Everkinetic completo (anexa subs por categoria)
applyExpandedLibrary(demoLib);

// exercícios sem ilustração própria recebem a imagem do GRUPO muscular (webp)
const GROUP_IMAGE: Record<string, string> = {
  peito: "/group-images/peito.webp",
  costas: "/group-images/costas.webp",
  ombro: "/group-images/ombro.webp",
  biceps: "/group-images/biceps.webp",
  triceps: "/group-images/triceps.webp",
  antebraco: "/group-images/antebraco.webp",
  abdomen: "/group-images/abdomen.webp",
  inferiores: "/group-images/inferiores.webp",
  cardio: "/group-images/cardio.webp",
  alongamento: "/group-images/alongamento.webp",
};
for (const cat of demoLib) {
  const gi = GROUP_IMAGE[cat.id];
  if (!gi) continue;
  for (const sub of cat.subs) {
    for (const ex of sub.exercises) {
      if (!ex.imageUrl) {
        ex.imageUrl = gi;
        ex.thumbUrl = gi;
      }
    }
  }
}

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
