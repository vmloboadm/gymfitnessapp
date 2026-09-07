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

export type SessionMeta = {
  feeling?: string | null;
  note?: string | null;
  duration_min?: number | null;
  feedback_at?: string | null;
  finished_by?: "student" | "staff" | "auto" | null;
  auto_finished?: boolean | null;
  workout_name?: string | null;
};

export type StudentSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  meta: SessionMeta | null;
  workout_id: string | null;
};

/**
 * Auto-finaliza sessões ativas abandonadas (iniciadas há +12h).
 * Marca como auto para o app pedir o feedback do treino anterior.
 */
export async function completeStaleSessions(studentId: string): Promise<void> {
  try {
    const sb = supabaseBrowser();
    const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data } = await sb
      .from("workout_sessions")
      .select("id, meta")
      .eq("student_id", studentId)
      .eq("status", "active")
      .lt("started_at", cutoff);
    const rows = (data ?? []) as Array<{ id: string; meta: SessionMeta | null }>;
    for (const r of rows) {
      await sb
        .from("workout_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          meta: { ...(r.meta ?? {}), auto_finished: true, finished_by: "auto" },
        } as never)
        .eq("id", r.id);
    }
  } catch {
    /* nunca bloqueia o treino */
  }
}

/** Última sessão concluída SEM feedback → o app pede "como foi o treino?". */
export async function getLastSessionNeedingFeedback(studentId: string): Promise<StudentSession | null> {
  try {
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("workout_sessions")
      .select("id, started_at, ended_at, status, meta, workout_id")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(5);
    const rows = (data ?? []) as StudentSession[];
    return rows.find((r) => !(r.meta as SessionMeta | null)?.feedback_at) ?? null;
  } catch {
    return null;
  }
}

/** Salva o feedback do aluno na sessão (sensação + nota + duração). */
export async function saveSessionFeedback(
  sessionId: string,
  fb: { feeling: string; note?: string | null; duration_min?: number | null; finished_by?: "student" | "staff" | "auto" }
): Promise<boolean> {
  try {
    const sb = supabaseBrowser();
    const { data: cur } = await sb.from("workout_sessions").select("meta").eq("id", sessionId).maybeSingle();
    const prev = ((cur as { meta: SessionMeta | null } | null)?.meta ?? {}) as SessionMeta;
    const { error } = await sb
      .from("workout_sessions")
      .update({
        meta: {
          ...prev,
          feeling: fb.feeling,
          note: fb.note ?? prev.note ?? null,
          duration_min: fb.duration_min ?? prev.duration_min ?? null,
          feedback_at: new Date().toISOString(),
          finished_by: fb.finished_by ?? prev.finished_by ?? "student",
        },
      } as never)
      .eq("id", sessionId);
    return !error;
  } catch {
    return false;
  }
}

/** Histórico recente de sessões do aluno (para o Diário no progresso). */
export async function getRecentSessions(studentId: string, limit = 14): Promise<StudentSession[]> {
  try {
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("workout_sessions")
      .select("id, started_at, ended_at, status, meta, workout_id")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as StudentSession[];
  } catch {
    return [];
  }
}
