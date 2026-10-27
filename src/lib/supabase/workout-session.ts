import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Sessão de treino em andamento (workout_sessions) — o personal vê ao vivo
 * no dashboard "Na academia agora" e pode encerrar pelo painel.
 */

export type ActiveSession = {
  id: string;
  started_at: string;
  workout_id: string | null;
  meta: SessionMeta | null;
};

export async function getActiveWorkoutSession(studentId: string): Promise<ActiveSession | null> {
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("workout_sessions")
    .select("id, started_at, workout_id, meta")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  return (data as ActiveSession | null) ?? null;
}

export type CheckinStart = {
  checkin_id: string;
  checked_at: string;
  session_id: string;
  started_at: string;
  existing?: boolean;
};

/** Check-in abre a presença E a sessão de treino no mesmo ato. */
export async function startCheckin(source: "app" | "nfc" | "qrcode" = "app"): Promise<CheckinStart | null> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("start_checkin" as never, { p_source: source } as never);
  if (error || !data) return null;
  return data as unknown as CheckinStart;
}

/** Fecha a presença associada à sessão. Idempotente no banco. */
export async function closeCheckinForSession(sessionId: string | null, source: "app" | "nfc" | "qrcode" = "app"): Promise<boolean> {
  try {
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("close_checkin" as never, {
      p_session_id: sessionId,
      p_source: source,
    } as never);
    return !error;
  } catch {
    return false;
  }
}

/** Adota a sessão aberta no check-in e liga a ficha escolhida. */
export async function updateWorkoutSession(
  sessionId: string,
  workoutId: string | null,
  meta: SessionMeta
): Promise<boolean> {
  try {
    const sb = supabaseBrowser();
    const { error } = await sb
      .from("workout_sessions")
      .update({ workout_id: workoutId, meta } as never)
      .eq("id", sessionId)
      .eq("status", "active");
    return !error;
  } catch {
    return false;
  }
}

/** Inicia (ou reusa) a sessão de treino ativa do aluno. Falha silenciosa. */
export async function startWorkoutSession(
  gymId: string,
  studentId: string,
  workoutId?: string | null,
  meta?: { slot?: string | null; dayIdx?: number | null; programId?: string | null; kind?: string | null; templateDay?: unknown; workout_name?: string | null } | null
): Promise<string | null> {
  try {
    const existing = await getActiveWorkoutSession(studentId);
    if (existing) return existing.id;
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("workout_sessions")
      .insert({
        gym_id: gymId,
        student_id: studentId,
        workout_id: workoutId ?? null,
        status: "active",
        started_at: new Date().toISOString(),
        meta: {
          ...(meta ?? {}),
          workout_name: meta?.workout_name ?? null,
        },
      } as never)
      .select("id")
      .single();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    /* sessão de treino é observabilidade — nunca bloqueia o treino */
    return null;
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
  /** retomada: de onde continuar (slot da rotação ou snapshot do provisório) */
  slot?: string | null;
  dayIdx?: number | null;
  programId?: string | null;
  kind?: "plan" | "template" | "checkin" | null;
  started_by?: "checkin" | "student" | "staff" | null;
  templateDay?: unknown;
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
 * Auto-finaliza sessões ativas abandonadas (iniciadas há +3h).
 * O mesmo teto da sessão local (`MAX_SESSION_HOURS`), para o banco não
 * continuar mostrando "na academia agora" depois que o aluno já saiu.
 * Marca como auto para o app pedir o feedback do treino anterior.
 */
export async function completeStaleSessions(studentId: string): Promise<void> {
  try {
    const sb = supabaseBrowser();
    // RPC fecha sessão E check-in em uma única operação, no servidor.
    const { error } = await sb.rpc("auto_close_stale_workouts" as never, {
      p_student: studentId,
    } as never);
    if (!error) return;

    // Fallback defensivo se a migration ainda não estiver no ambiente.
    const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const { data } = await sb
      .from("workout_sessions")
      .select("id, meta")
      .eq("student_id", studentId)
      .eq("status", "active")
      .lt("started_at", cutoff);
    const rows = (data ?? []) as Array<{ id: string; meta: SessionMeta | null }>;
    for (const r of rows) {
      await closeCheckinForSession(r.id).catch(() => {});
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

/** Última sessão concluída SEM feedback → o app pede "como foi o treino?".
 * Só sessões das últimas 36h: treino velho sem feedback não pergunta de novo
 * (evita o "pergunta duas vezes" quando há sessões acumuladas). */
export async function getLastSessionNeedingFeedback(studentId: string): Promise<StudentSession | null> {
  try {
    const sb = supabaseBrowser();
    const cutoff = new Date(Date.now() - 36 * 3600000).toISOString();
    const { data } = await sb
      .from("workout_sessions")
      .select("id, started_at, ended_at, status, meta, workout_id")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .gte("ended_at", cutoff)
      .order("ended_at", { ascending: false })
      .limit(5);
    const rows = (data ?? []) as StudentSession[];
    // Sessão encerrada por inatividade não vira pergunta de feedback: o aluno
    // já saiu e não faz sentido pedir "como foi o treino?" horas depois.
    return rows.find((r) => {
      const meta = r.meta as SessionMeta | null;
      return !meta?.feedback_at && !meta?.auto_finished;
    }) ?? null;
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
