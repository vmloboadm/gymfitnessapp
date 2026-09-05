/**
 * Camada de sincronização do app: CADA função decide entre o modo de teste
 * (dados locais) e a produção real (Supabase). Nenhuma tela fala direto com
 * os dois mundos — sempre passa por aqui.
 *
 * Produção usa as tabelas reais do blueprint:
 *   - alunos: profiles (role=student) + checkins + workout_logs + student_workouts
 *   - planos: workout_programs + workout_days + workout_exercises + student_workouts
 *   - aprovações: premium_requests
 *   - ranking: leaderboard + leaderboard_adjustments
 */

import { isDemoMode, demoFallback } from "~/lib/demo-bridge";
import { supabaseBrowser } from "~/lib/supabase/client";
import { demoPersonalStudents, type PersonalStudent } from "~/lib/personal-data";
import {
  listAssignedWorkouts,
  saveAssignedWorkout,
  updateAssignedWorkout,
  deleteAssignedWorkout,
  listApprovals,
  createApproval,
  resolveApproval,
  listPointAdjustments,
  addPointAdjustment,
  type AssignedWorkout,
  type ApprovalRequest,
  type PointAdjustment,
} from "~/lib/trainer-store";
import type { WorkoutPlan } from "~/lib/ai/local-gen";

export type GymUser = { id: string; gymId: string; name: string };

/* ------------------------------------------------------------------ */
/* Alunos da academia                                                  */
/* ------------------------------------------------------------------ */

type CheckinRow = { student_id: string; checked_at: string };
type LogRow = { student_id: string; rpe: number | null; date: string; exercise_name?: string | null };

async function fetchRealStudents(gymId: string): Promise<PersonalStudent[]> {
  const sb = supabaseBrowser();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const [profRes, checkRes, logRes, swRes, progRes] = await Promise.all([
    sb.from("profiles").select("id, name, avatar_url, phone, whatsapp_consent").eq("gym_id", gymId).eq("role", "student").order("name"),
    sb.from("checkins").select("student_id, checked_at").eq("gym_id", gymId).gte("checked_at", since),
    sb.from("workout_logs").select("student_id, rpe, date").eq("gym_id", gymId).gte("date", since),
    sb.from("student_workouts").select("student_id, status, program_id").eq("gym_id", gymId),
    sb.from("workout_programs").select("id, name").eq("gym_id", gymId),
  ]);

  const profiles = (profRes.data ?? []) as Array<{ id: string; name: string; avatar_url: string | null; phone: string | null; whatsapp_consent: boolean | null }>;
  const checkins = (checkRes.data ?? []) as CheckinRow[];
  const logs = (logRes.data ?? []) as LogRow[];
  const assignments = (swRes.data ?? []) as Array<{ student_id: string; status: string; program_id: string }>;
  const progNames = new Map<string, string>(((progRes.data ?? []) as Array<{ id: string; name: string }>).map((x) => [x.id, x.name]));

  const daysAgo = (iso: string | null | undefined): number => {
    if (!iso) return 30;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  };

  return profiles.map((p) => {
    const myChecks = checkins.filter((c) => c.student_id === p.id).map((c) => c.checked_at).sort().reverse();
    const last = myChecks[0] ?? null;
    // streak: dias consecutivos com check-in a partir do último
    let streak = 0;
    const seen = new Set(myChecks.map((c) => c.slice(0, 10)));
    for (let d = 0; d < 30; d++) {
      const key = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
      if (seen.has(key)) streak++;
      else if (d > 0) break;
    }
    const myLogs = logs.filter((l) => l.student_id === p.id);
    const lastLog = myLogs.sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
    const active = assignments.filter((a) => a.student_id === p.id)[0];
    return {
      id: p.id,
      profile_id: p.id,
      name: p.name,
      avatar: p.avatar_url ?? null,
      phone: p.phone,
      whatsapp_consent: p.whatsapp_consent ?? true,
      lastTrainingDaysAgo: last ? daysAgo(last) : 30,
      streak,
      activeWorkout: active ? progNames.get(active.program_id) ?? null : null,
      lastWorkout: null,
      lastRpe: lastLog?.rpe ?? undefined,
      freq: 3,
    };
  });
}

/** Alunos da academia: demo → lista local; produção → banco. */
export { listAssignedWorkouts, updateAssignedWorkout, deleteAssignedWorkout, listApprovals, resolveApproval, createApproval };

export async function getGymStudents(gymId: string): Promise<PersonalStudent[]> {
  if (isDemoMode()) return demoPersonalStudents();
  try {
    const real = await fetchRealStudents(gymId);
    return real;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Planos atribuídos (Co-Pilot → aluno)                                */
/* ------------------------------------------------------------------ */

async function assignReal(
  gymId: string,
  trainerId: string,
  student: PersonalStudent,
  plan: WorkoutPlan,
  _notes: string | null
): Promise<void> {
  const sb = supabaseBrowser();

  const { data: prog, error: progErr } = await sb
    .from("workout_programs")
    .insert(({
      gym_id: gymId,
      trainer_id: trainerId,
      name: plan.nome,
      objective: plan.objetivo,
      created_via: "ia",
      ai_draft: JSON.stringify(plan),
      reviewed_by: trainerId,
    } as never))
    .select("id")
    .single();
  if (progErr || !prog) throw new Error(progErr?.message ?? "falha ao criar programa");

  const programId = (prog as { id: string }).id;

  // resolve ids reais dos exercícios pelo nome (biblioteca global + do gym)
  const { data: exRows } = await sb.from("exercises").select("id, name").or(`gym_id.is.null,gym_id.eq.${gymId}`);
  const exList = (exRows ?? []) as Array<{ id: string; name: string }>;
  const byName = new Map<string, string>(exList.map((e) => [e.name.toLowerCase(), e.id]));
  // fallback: tabela pode estar vazia — usa um exercício existente como placeholder (nome real fica no notes)
  const placeholder = exList[0]?.id ?? null;

  for (let di = 0; di < plan.dias.length; di++) {
    const day = plan.dias[di];
    const { data: dayRow, error: dayErr } = await sb
      .from("workout_days")
      .insert(({ gym_id: gymId, program_id: programId, name: day.nome, day_order: di + 1 } as never))
      .select("id")
      .single();
    if (dayErr || !dayRow) continue;
    const dayId = (dayRow as { id: string }).id;

    const rows = day.exercicios.map((e, i) => ({
      gym_id: gymId,
      day_id: dayId,
      exercise_id: byName.get(e.exercicio.toLowerCase()) ?? byName.get(e.exercicio.toLowerCase().split(" ")[0]) ?? placeholder,
      sets: e.series,
      reps: e.reps,
      rest_seconds: parseInt(e.descanso) || 60,
      rpe: e.rpe,
      notes: `${e.exercicio}${e.dica ? `. ${e.dica}` : ""}`,
      ord: i + 1,
    }));
    if (rows.length) {
      const { error: wexErr } = await sb.from("workout_exercises").insert(rows as never);
      if (wexErr) throw new Error("exercicios do plano: " + wexErr.message);
    }
  }

  const { error: swErr } = await sb.from("student_workouts").insert(({
    gym_id: gymId,
    student_id: student.id,
    program_id: programId,
    status: "active",
  } as never));
  if (swErr) throw new Error(swErr.message);
}

/** Aprovar plano do Co-Pilot: demo → local; produção → banco. */
export async function approvePlan(opts: {
  gymId: string;
  trainerId: string;
  student: PersonalStudent;
  plan: WorkoutPlan;
  notes: string | null;
}): Promise<void> {
  if (isDemoMode()) {
    saveAssignedWorkout({
      studentId: opts.student.id,
      studentName: opts.student.name,
      name: opts.plan.nome,
      notes: opts.notes,
      frequency: opts.plan.frequencia,
      level: opts.plan.nivel,
      exercises: opts.plan.dias.flatMap((d) =>
        d.exercicios.map((e) => ({ name: e.exercicio, sets: e.series, reps: e.reps, rest: e.descanso }))
      ),
      plan: opts.plan,
      source: "ia",
    });
    return;
  }
  await assignReal(opts.gymId, opts.trainerId, opts.student, opts.plan, opts.notes);
}

/** Planos do aluno logado (aba Treino): demo → local; produção → banco. */
export async function fetchMyAssignedPlans(
  userId: string,
  gymId: string
): Promise<AssignedWorkout[]> {
  if (isDemoMode()) return listAssignedWorkouts();
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("student_workouts")
    .select(`
      id, status, assigned_at,
      workout_programs (
        id, name, objective, ai_draft, created_at,
        workout_days ( id, name, day_order,
          workout_exercises ( exercise_id, sets, reps, rest_seconds, rpe, notes, ord, exercises ( name ) )
        )
      )
    `)
    .eq("student_id", userId)
    .eq("gym_id", gymId)
    .order("assigned_at", { ascending: false })
    .limit(5);

  type SwRow = {
    id: string;
    assigned_at: string;
    workout_programs: {
      name: string;
      objective: string;
      ai_draft: string | null;
      workout_days: Array<{
        name: string;
        day_order: number;
        workout_exercises: Array<{ sets: number; reps: string; rest_seconds: number; rpe: number | null; notes: string | null; ord: number; exercises?: { name: string } | null }>;
      }>;
    };
  };

  const rows = (data ?? []) as unknown as Array<SwRow | null>;
  return rows
    .filter((r): r is SwRow => !!r?.workout_programs)
    .map((r) => {
      const prog = r.workout_programs!;
      const days = [...(prog.workout_days ?? [])].sort((a, b) => a.day_order - b.day_order);
      let daysSelected: string[] | undefined;
      try {
        const draft = prog.ai_draft ? (JSON.parse(prog.ai_draft) as { daysSelected?: string[] }) : null;
        daysSelected = draft?.daysSelected;
      } catch {
        daysSelected = undefined;
      }
      if (!daysSelected?.length) {
        daysSelected = ["Seg", "Ter", "Qua", "Qui", "Sex"].slice(0, Math.min(days.length, 5));
      }
      return {
        id: r.id,
        studentId: userId,
        studentName: "Você",
        name: prog.name,
        notes: null,
        frequency: `${days.length}x semana`,
        level: prog.objective ?? "Treino",
        exercises: days.flatMap((d) => d.workout_exercises.map((e) => ({ name: e.exercises?.name ?? e.notes?.split(".")[0] ?? "Exercício", sets: e.sets, reps: e.reps, rest: `${e.rest_seconds}s` }))),
        plan: {
          nome: prog.name,
          frequencia: `${days.length}x semana`,
          nivel: prog.objective ?? "Treino",
          objetivo: prog.objective ?? "Treino",
          observacao_geral: "",
          daysSelected,
          dias: days.map((d) => ({
            nome: d.name,
            foco: d.name,
            aquecimento: [],
            exercicios: d.workout_exercises
              .sort((a, b) => a.ord - b.ord)
              .map((e) => ({
                exercicio: e.exercises?.name ?? e.notes?.split(".")[0] ?? "Exercício",
                series: e.sets,
                reps: e.reps,
                descanso: `${e.rest_seconds}s`,
                rpe: e.rpe ?? 7,
                dica: e.notes?.split(".")[1]?.trim() ?? "",
              })),
            finalizador: "",
          })),
          cardio: "",
        },
        source: "ia" as const,
        created_at: r.assigned_at,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Aprovações (premium_requests)                                       */
/* ------------------------------------------------------------------ */

type ReqRow = {
  id: string;
  student_id: string;
  request_type: string;
  details: string | null;
  status: string;
  created_at: string;
  profiles: { name: string } | null;
};

export async function getRequests(gymId: string): Promise<ApprovalRequest[]> {
  if (isDemoMode()) return listApprovals();
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("premium_requests")
    .select("id, student_id, request_type, details, status, created_at, profiles(name)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (data ?? []) as unknown as ReqRow[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.profiles?.name ?? "Aluno",
    type: r.request_type === "report" && !(r.details ?? "").startsWith("[carga]") ? ("premium" as const) : ("carga" as const),
    message: (r.details ?? "").replace(/^\[(carga|premium)\]\s*/, ""),
    status: r.status === "aprovado" || r.status === "approved" ? ("aprovado" as const) : r.status === "recusado" || r.status === "rejected" ? ("recusado" as const) : ("pendente" as const),
    created_at: r.created_at,
    resolved_at: null,
  }));
}

export async function submitRequest(opts: {
  gymId: string;
  userId: string;
  userName: string;
  type: "premium" | "carga";
  message: string;
}): Promise<void> {
  if (isDemoMode()) {
    createApproval({
      studentId: opts.userId,
      studentName: opts.userName,
      type: opts.type,
      message: opts.message,
    });
    return;
  }
  const sb = supabaseBrowser();
  await sb.from("premium_requests").insert({
    gym_id: opts.gymId,
    student_id: opts.userId,
    request_type: opts.type === "premium" ? "report" : "other",
    details: `[${opts.type}] ${opts.message}`,
    status: "pending",
  } as never);
}

/** Contagem de aprovações pendentes do gym (produção lê o banco). */
export async function countPendingRequests(gymId: string): Promise<number> {
  if (isDemoMode()) {
    const { pendingApprovalCount } = await import("~/lib/trainer-store");
    return pendingApprovalCount();
  }
  const sb = supabaseBrowser();
  const { count } = await sb
    .from("premium_requests")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("status", "pending");
  return count ?? 0;
}

export async function decideRequest(id: string, status: "aprovado" | "recusado", reviewerId: string): Promise<void> {
  if (isDemoMode()) {
    resolveApproval(id, status);
    return;
  }
  const sb = supabaseBrowser();
  await sb
    .from("premium_requests")
    .update({ status: status === "aprovado" ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("id", id);
}

/* ------------------------------------------------------------------ */
/* Ranking: base + ajustes do personal                                 */
/* ------------------------------------------------------------------ */

export type RankRow = {
  studentId: string;
  name: string;
  avatar: string | null;
  basePoints: number;
  adjustments: PointAdjustment[];
  streakZeroed: boolean;
};

export async function getRankingRows(gymId: string, students: PersonalStudent[]): Promise<RankRow[]> {
  if (isDemoMode()) {
    const ranks = (demoFallback("leaderboard") as Array<{ student_id: string; points: number }>) ?? [];
    const adj = listPointAdjustments();
    return students.map((s) => {
      const base = ranks.find((r) => r.student_id === s.profile_id)?.points ?? 0;
      const mine = adj.filter((a) => a.studentId === s.id);
      return {
        studentId: s.id,
        name: s.name,
        avatar: s.avatar,
        basePoints: base,
        adjustments: mine,
        streakZeroed: mine.some((a) => a.type === "penalidade"),
      };
    }).sort((a, b) => b.basePoints + b.adjustments.reduce((x, a) => x + a.points, 0) - (a.basePoints + a.adjustments.reduce((x, y) => x + y.points, 0)));
  }

  const sb = supabaseBrowser();
  const [{ data: lb }, { data: adj }] = await Promise.all([
    sb.from("leaderboard").select("student_id, points").eq("gym_id", gymId),
    sb.from("leaderboard_adjustments").select("student_id, kind, points, reason, created_at").eq("gym_id", gymId),
  ]);

  const lbRows = (lb ?? []) as unknown as Array<{ student_id: string; points: number }>;
  const lbMap = new Map<string, number>(lbRows.map((r) => [r.student_id, r.points]));
  const rows: RankRow[] = students.map((s) => {
    const adjRows = (adj ?? []) as unknown as Array<{ student_id: string; kind: string; points: number; reason: string | null; created_at: string }>;
  const mine = adjRows.filter((a) => a.student_id === s.id);
    return {
      studentId: s.id,
      name: s.name,
      avatar: s.avatar,
      basePoints: lbMap.get(s.id) ?? 0,
      adjustments: mine.map((a) => ({
        id: a.created_at,
        studentId: a.student_id,
        studentName: s.name,
        type: a.kind === "validacao" ? ("validacao" as const) : a.kind === "bonus" ? ("bonus" as const) : ("penalidade" as const),
        points: a.points,
        reason: a.reason ?? "",
        created_at: a.created_at,
      })),
      streakZeroed: mine.some((a) => a.kind === "penalidade"),
    };
  });
  return rows.sort(
    (a, b) =>
      b.basePoints + b.adjustments.reduce((x, y) => x + y.points, 0) -
      (a.basePoints + a.adjustments.reduce((x, y) => x + y.points, 0))
  );
}

export async function saveAdjustment(opts: {
  gymId: string;
  userId: string;
  student: PersonalStudent;
  type: "validacao" | "bonus" | "penalidade";
  points: number;
  reason: string;
}): Promise<void> {
  if (isDemoMode()) {
    addPointAdjustment({
      studentId: opts.student.id,
      studentName: opts.student.name,
      type: opts.type,
      points: opts.points,
      reason: opts.reason,
    });
    return;
  }
  const sb = supabaseBrowser();
  await sb.from("leaderboard_adjustments").insert({
    gym_id: opts.gymId,
    student_id: opts.student.id,
    kind: opts.type,
    points: opts.points,
    reason: opts.reason,
    created_by: opts.userId,
  } as never);
}
