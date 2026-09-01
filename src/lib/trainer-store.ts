/**
 * Store local do Personal (modo demo): treinos aprovados pelo Co-Pilot,
 * vinculados a alunos. Persiste no localStorage (mesmo padrão do feed-store)
 * e emite evento para a área do aluno reagir em tempo real.
 * Em produção o INSERT vai para workout_programs / workout_days / workout_exercises.
 */

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
  source: "ia" | "template" | "manual";
  created_at: string;
};

const KEY = "gymfit_trainer_workouts_v1";
export const TRAINER_WORKOUTS_EVENT = "gymfit-trainer-workouts";

function readStore(): AssignedWorkout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssignedWorkout[]) : [];
  } catch {
    return [];
  }
}

function writeStore(list: AssignedWorkout[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
    window.dispatchEvent(new Event(TRAINER_WORKOUTS_EVENT));
  } catch {
    // storage cheio: segue sem persistir
  }
}

export function listAssignedWorkouts(): AssignedWorkout[] {
  return readStore();
}

export function listWorkoutsForStudent(studentId: string): AssignedWorkout[] {
  return readStore()
    .filter((w) => w.studentId === studentId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function saveAssignedWorkout(
  w: Omit<AssignedWorkout, "id" | "created_at">
): AssignedWorkout {
  const full: AssignedWorkout = {
    ...w,
    id: `aw-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  writeStore([full, ...readStore()]);
  return full;
}

/** Edits locais da biblioteca (renomear / vincular aparelho) */
type LibraryEdits = Record<string, { name?: string; equipment?: string }>;
const KEY_EDITS = "gymfit_library_edits_v1";

export function readLibraryEdits(): LibraryEdits {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY_EDITS) ?? "{}") as LibraryEdits;
  } catch {
    return {};
  }
}

export function saveLibraryEdit(id: string, edit: { name?: string; equipment?: string }) {
  const edits = readLibraryEdits();
  edits[id] = { ...edits[id], ...edit };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY_EDITS, JSON.stringify(edits));
    } catch {
      // ignora
    }
  }
}
