import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Sessão de treino em andamento (workout_sessions) — o personal vê ao vivo
 * no dashboard "Na academia agora" e pode encerrar pelo painel.
 */

export async function getActiveWorkoutSession(studentId: string): Promise<{ id: string } | null> {
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("workout_sessions")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

/** Inicia (ou reusa) a sessão de treino ativa do aluno. Falha silenciosa. */
export async function startWorkoutSession(gymId: string, studentId: string, workoutId?: string | null): Promise<void> {
  try {
    const existing = await getActiveWorkoutSession(studentId);
    if (existing) return;
    const sb = supabaseBrowser();
    await sb.from("workout_sessions").insert({
      gym_id: gymId,
      student_id: studentId,
      workout_id: workoutId ?? null,
      status: "active",
      started_at: new Date().toISOString(),
    } as never);
  } catch {
    /* sessão de treino é observabilidade — nunca bloqueia o treino */
  }
}

/** Encerra a sessão ativa do aluno (finalize do treino ou ação do staff). */
export async function completeWorkoutSession(studentId: string): Promise<void> {
  try {
    const sb = supabaseBrowser();
    await sb
      .from("workout_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() } as never)
      .eq("student_id", studentId)
      .eq("status", "active");
  } catch {
    /* idem */
  }
}
