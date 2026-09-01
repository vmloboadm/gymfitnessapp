/**
 * Store local do Personal (modo demo): treinos atribuídos, ajustes de pontos
 * do ranking, aprovações de alunos, penalidades de streak e edits de biblioteca.
 * Persiste no localStorage (mesmo padrão do feed-store) e emite eventos para
 * as áreas do personal e do aluno reagirem em tempo real.
 * Em produção tudo isso vira tabelas Supabase (workout_programs, leaderboard
 * adjustments, approvals) com o mesmo formato de dados.
 */

import type { WorkoutPlan } from "~/lib/ai/local-gen";

export type AssignedExercise = {
  name: string;
  sets: number;
  reps: string;
  rest: string;
};

export type AssignedWorkout = {
  id: string;
  studentId: string;
  studentName: string;
  name: string;
  notes: string | null;
  frequency: string;
  level: string;
  exercises: AssignedExercise[];
  /** Plano completo multi-dias (Co-Pilot IA). Treinos antigos têm só exercises. */
  plan?: WorkoutPlan;
  source: "ia" | "template" | "manual";
  created_at: string;
};

export type PointAdjustment = {
  id: string;
  studentId: string;
  studentName: string;
  /** validacao = conquista confirmada (+75) | bonus = esforço (+50) | penalidade = falta (0 pts, zera streak) */
  type: "validacao" | "bonus" | "penalidade";
  points: number;
  reason: string;
  created_at: string;
};

export type ApprovalRequest = {
  id: string;
  studentId: string;
  studentName: string;
  /** premium = desbloqueio de plano | carga = ajuste de carga no treino */
  type: "premium" | "carga";
  message: string;
  status: "pendente" | "aprovado" | "recusado";
  created_at: string;
  resolved_at?: string | null;
};

const KEY = "gymfit_trainer_workouts_v1";
const KEY_POINTS = "gymfit_point_adjustments_v1";
const KEY_APPROVALS = "gymfit_approvals_v1";
const KEY_STREAK = "gymfit_streak_override_v1";
const KEY_SEEN = "gymfit_workouts_seen_v1";

export const TRAINER_WORKOUTS_EVENT = "gymfit-trainer-workouts";
export const TRAINER_POINTS_EVENT = "gymfit-trainer-points";
export const TRAINER_APPROVALS_EVENT = "gymfit-trainer-approvals";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage cheio: segue sem persistir
  }
}

// ---------------------------------------------------------------------------
// Treinos atribuídos
// ---------------------------------------------------------------------------

export function listAssignedWorkouts(): AssignedWorkout[] {
  return readJSON<AssignedWorkout[]>(KEY, []);
}

export function listWorkoutsForStudent(studentId: string): AssignedWorkout[] {
  return listAssignedWorkouts()
    .filter((w) => w.studentId === studentId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function emitWorkouts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TRAINER_WORKOUTS_EVENT));
}

export function saveAssignedWorkout(
  w: Omit<AssignedWorkout, "id" | "created_at">
): AssignedWorkout {
  const full: AssignedWorkout = {
    ...w,
    id: `aw-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  writeJSON(KEY, [full, ...listAssignedWorkouts()].slice(0, 60));
  emitWorkouts();
  return full;
}

export function updateAssignedWorkout(id: string, patch: Partial<AssignedWorkout>) {
  writeJSON(
    KEY,
    listAssignedWorkouts().map((w) => (w.id === id ? { ...w, ...patch } : w))
  );
  emitWorkouts();
}

export function deleteAssignedWorkout(id: string) {
  writeJSON(KEY, listAssignedWorkouts().filter((w) => w.id !== id));
  emitWorkouts();
}

/** Notificação do aluno: treinos ainda não vistos por ele (demo: 1 aluno por navegador). */
export function unseenCount(): number {
  const seen = readJSON<string[]>(KEY_SEEN, []);
  return listAssignedWorkouts().filter((w) => !seen.includes(w.id)).length;
}

export function markAllSeen() {
  writeJSON(KEY_SEEN, listAssignedWorkouts().map((w) => w.id));
  emitWorkouts();
}

// ---------------------------------------------------------------------------
// Poderes de ranking: ajustes de pontos e penalidade de streak
// ---------------------------------------------------------------------------

export const POINT_RULES = {
  validacao: 75,
  bonus: 50,
  penalidade: 0,
} as const;

export function listPointAdjustments(): PointAdjustment[] {
  return readJSON<PointAdjustment[]>(KEY_POINTS, []);
}

export function adjustmentsForStudent(studentId: string): PointAdjustment[] {
  return listPointAdjustments().filter((a) => a.studentId === studentId);
}

/** Score final do aluno = base do leaderboard + ajustes do personal. */
export function adjustedPoints(basePoints: number, studentId: string): number {
  return listPointAdjustments()
    .filter((a) => a.studentId === studentId)
    .reduce((acc, a) => acc + a.points, basePoints);
}

export function addPointAdjustment(
  a: Omit<PointAdjustment, "id" | "created_at">
): PointAdjustment {
  const full: PointAdjustment = {
    ...a,
    id: `pa-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  writeJSON(KEY_POINTS, [full, ...listPointAdjustments()].slice(0, 120));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TRAINER_POINTS_EVENT));
  return full;
}

/** Punição de falta: streak zerado pro personal e pro aluno. */
export function zeroStreak(studentId: string) {
  const map = readJSON<Record<string, number>>(KEY_STREAK, {});
  map[studentId] = 0;
  writeJSON(KEY_STREAK, map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TRAINER_POINTS_EVENT));
    window.dispatchEvent(new Event(TRAINER_WORKOUTS_EVENT));
  }
}

export function streakOverride(studentId: string): number | undefined {
  const map = readJSON<Record<string, number>>(KEY_STREAK, {});
  return map[studentId];
}

/** Aplica penalidade completa (pontos + streak zero) num clique. */
export function applyPenalty(studentId: string, studentName: string) {
  addPointAdjustment({
    studentId,
    studentName,
    type: "penalidade",
    points: 0,
    reason: "Streak zerado pelo Personal (faltas)",
  });
  zeroStreak(studentId);
}

// ---------------------------------------------------------------------------
// Caixa de aprovações (pedidos dos alunos)
// ---------------------------------------------------------------------------

export function listApprovals(): ApprovalRequest[] {
  return readJSON<ApprovalRequest[]>(KEY_APPROVALS, []);
}

export function pendingApprovalCount(): number {
  return listApprovals().filter((a) => a.status === "pendente").length;
}

function emitApprovals() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TRAINER_APPROVALS_EVENT));
}

export function createApproval(
  a: Omit<ApprovalRequest, "id" | "created_at" | "status">
): ApprovalRequest {
  const full: ApprovalRequest = {
    ...a,
    id: `ap-${Date.now()}`,
    status: "pendente",
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  writeJSON(KEY_APPROVALS, [full, ...listApprovals()].slice(0, 80));
  emitApprovals();
  return full;
}

export function resolveApproval(id: string, status: "aprovado" | "recusado") {
  writeJSON(
    KEY_APPROVALS,
    listApprovals().map((a) =>
      a.id === id ? { ...a, status, resolved_at: new Date().toISOString() } : a
    )
  );
  emitApprovals();
}

// ---------------------------------------------------------------------------
// Edits locais da biblioteca (renomear / vincular aparelho)
// ---------------------------------------------------------------------------

type LibraryEdits = Record<string, { name?: string; equipment?: string }>;
const KEY_EDITS = "gymfit_library_edits_v1";

export function readLibraryEdits(): LibraryEdits {
  return readJSON<LibraryEdits>(KEY_EDITS, {});
}

export function saveLibraryEdit(id: string, edit: { name?: string; equipment?: string }) {
  const edits = readLibraryEdits();
  edits[id] = { ...edits[id], ...edit };
  writeJSON(KEY_EDITS, edits);
}
