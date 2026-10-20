import { NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase/admin";
import { authenticateRequest } from "~/lib/api-auth";

export const runtime = "nodejs";

/**
 * POST /api/push/subscribe — registra a assinatura Web Push do dispositivo.
 * Body: { endpoint, keys: { p256dh, auth } }. Upsert por endpoint (re-assinatura).
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const keyAuth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !keyAuth) {
    return NextResponse.json(
      { ok: false, error: "Campos obrigatórios: endpoint, keys.p256dh e keys.auth." },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profErr || !profile?.gym_id) {
    return NextResponse.json({ ok: false, error: "Perfil indisponível." }, { status: 400 });
  }

  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        gym_id: profile.gym_id,
        user_id: auth.user.id,
        endpoint,
        p256dh,
        auth: keyAuth,
      } as never,
      { onConflict: "endpoint" }
    );
  if (error) {
    return NextResponse.json({ ok: false, error: "Falha ao salvar a assinatura." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
