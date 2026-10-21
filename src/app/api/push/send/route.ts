import { NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase/admin";
import { authenticateRequest } from "~/lib/api-auth";
import { deliverNotification } from "~/lib/push-send";

export const runtime = "nodejs";
export const maxDuration = 30;

const STAFF_ROLES = ["trainer", "manager", "admin"] as const;

/**
 * POST /api/push/send — envia notificação in-app + Web Push em massa.
 * Body: { userIds: string[] (máx 50), title, body, url? }.
 * Só staff (trainer/manager/admin) da mesma academia do chamador.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { userIds?: unknown; title?: unknown; body?: unknown; url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined;

  if (userIds.length === 0 || !title || !text) {
    return NextResponse.json(
      { ok: false, error: "Campos obrigatórios: userIds, title e body." },
      { status: 400 }
    );
  }
  if (userIds.length > 50) {
    return NextResponse.json(
      { ok: false, error: "Envie no máximo 50 usuários por request." },
      { status: 413 }
    );
  }

  const admin = supabaseAdmin();
  const { data: caller, error: callerErr } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (callerErr || !caller?.gym_id) {
    return NextResponse.json({ ok: false, error: "Perfil indisponível." }, { status: 400 });
  }
  const role = caller.role as string;
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { ok: false, error: "Apenas a equipe pode enviar notificações." },
      { status: 403 }
    );
  }

  const { data: targets } = await admin
    .from("profiles")
    .select("id")
    .eq("gym_id", caller.gym_id)
    .in("id", userIds);
  const sameGym = (targets ?? []).map((t) => t.id);
  if (sameGym.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { sent, diag } = await deliverNotification(admin, {
    gymId: caller.gym_id,
    userIds: sameGym,
    title,
    body: text,
    url,
  });
  return NextResponse.json({ ok: true, sent, ...(diag ? { diag } : {}) });
}
