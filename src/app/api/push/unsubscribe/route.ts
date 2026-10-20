import { NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase/admin";
import { authenticateRequest } from "~/lib/api-auth";

export const runtime = "nodejs";

/**
 * POST /api/push/unsubscribe — remove a assinatura do próprio usuário.
 * Body: { endpoint }.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "Campo endpoint obrigatório." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
