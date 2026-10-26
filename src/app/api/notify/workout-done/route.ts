import { NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase/admin";
import { authenticateRequest } from "~/lib/api-auth";
import { deliverNotification } from "~/lib/push-send";
import { sendWhatsAppText, workoutDoneMessage } from "~/lib/whatsapp-auto";
import { normalizeBRPhone } from "~/lib/whatsapp";
import { logger } from "~/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/notify/workout-done — chamado pelo ALUNO após concluir o treino.
 * Notifica o personal vinculado + gestores do gym (in-app + push) e,
 * quando o provider está configurado, envia WhatsApp de confirmação ao aluno.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: {
    workoutName?: unknown;
    exerciseCount?: unknown;
    totalVolumeKg?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const workoutName =
    typeof body.workoutName === "string" && body.workoutName.trim()
      ? body.workoutName.trim().slice(0, 80)
      : null;
  const exerciseCount =
    typeof body.exerciseCount === "number" && Number.isFinite(body.exerciseCount)
      ? Math.max(0, Math.min(999, Math.round(body.exerciseCount)))
      : null;
  const totalVolumeKg =
    typeof body.totalVolumeKg === "number" && Number.isFinite(body.totalVolumeKg) && body.totalVolumeKg > 0
      ? Math.round(body.totalVolumeKg)
      : null;

  const admin = supabaseAdmin();
  const { data: student, error: studErr } = await admin
    .from("profiles")
    .select("id, name, gym_id, phone, whatsapp_consent")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (studErr || !student?.gym_id) {
    return NextResponse.json({ ok: false, error: "Perfil indisponível." }, { status: 400 });
  }

  const [trainersRes, managersRes] = await Promise.all([
    admin.from("student_trainers").select("trainer_id").eq("student_id", student.id),
    admin
      .from("profiles")
      .select("id")
      .eq("gym_id", student.gym_id)
      .in("role", ["manager", "admin"]),
  ]);
  const staffIds = [
    ...new Set([
      ...(trainersRes.data ?? []).map((t) => t.trainer_id),
      ...(managersRes.data ?? []).map((m) => m.id),
    ]),
  ];

  const nomeAluno = (student.name ?? "").trim() || "Um aluno";
  const treinoLabel = workoutName ?? "o treino de hoje";
  const extras: string[] = [];
  if (exerciseCount && exerciseCount > 0) {
    extras.push(` · ${exerciseCount} exercício${exerciseCount === 1 ? "" : "s"}`);
  }
  if (totalVolumeKg) {
    extras.push(` · ${totalVolumeKg} kg movidos`);
  }
  const notifBody = `"${nomeAluno}" concluiu "${treinoLabel}"${extras.join("")}`;

  if (staffIds.length > 0) {
    await deliverNotification(admin, {
      gymId: student.gym_id,
      userIds: staffIds,
      title: "Treino concluído",
      body: notifBody,
      url: "/app/personal/dashboard",
    }).catch((err) => logger.error("notify.workout_done_push", err));
  }

  let whatsapp: "sent" | "skipped" | "error" = "skipped";
  const phone = normalizeBRPhone(student.phone);
  // LGPD: o aviso automático para o aluno só sai com consentimento explícito
  // (o onboarding grava whatsapp_consent). Sem isso, o push/in-app do staff
  // continua, mas o WhatsApp do aluno não é enviado.
  if (phone && student.whatsapp_consent === true) {
    try {
      const detalhe =
        exerciseCount || totalVolumeKg
          ? [
              exerciseCount ? `${exerciseCount} exercício${exerciseCount === 1 ? "" : "s"}` : null,
              totalVolumeKg ? `${totalVolumeKg} kg movidos` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined;
      const result = await sendWhatsAppText(
        phone,
        workoutDoneMessage(nomeAluno, treinoLabel === "o treino de hoje" ? "hoje" : treinoLabel, detalhe)
      );
      whatsapp = result.skipped ? "skipped" : result.ok ? "sent" : "error";
    } catch (err) {
      logger.error("notify.workout_done_whatsapp", err);
      whatsapp = "error";
    }
  }

  return NextResponse.json({ ok: true, whatsapp });
}
