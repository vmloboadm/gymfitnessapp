import { NextResponse } from "next/server";
import { supabaseAdmin } from "~/lib/supabase/admin";
import { sendPushToUser } from "~/lib/push-send";
import { pushAllowed, routePush } from "~/lib/push-routing";
import { logger } from "~/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * POST /api/push/dispatch { id } — chamado pelo PRÓPRIO BANCO (pg_net) logo
 * depois que um aviso entra no sininho (trigger trg_dispatch_push).
 *
 * Não precisa de segredo: a rota só envia avisos que já existem, ainda não
 * enviados (pushed_at nulo), com menos de 10 min, e sempre para o dono do
 * aviso. Chamar de fora no máximo antecipa um push que já ia sair.
 */
const MAX_AGE_MS = 10 * 60_000;
const SAME_TAG_COOLDOWN_MS = 10 * 60_000;

export async function POST(request: Request) {
  let id: string | null = null;
  try {
    const body = (await request.json()) as { id?: unknown };
    id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  } catch {
    id = null;
  }
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = supabaseAdmin();
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString();

  // marca antes de enviar: duas chamadas iguais não mandam 2 pushes
  const { data: rows, error } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() } as never)
    .eq("id", id)
    .is("pushed_at" as never, null)
    .gte("created_at", since)
    .select("id, user_id, title, body");
  if (error) {
    logger.error("push.dispatch_claim", error, { id });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const n = (rows as Array<{ id: string; user_id: string; title: string; body: string }> | null)?.[0];
  if (!n) return NextResponse.json({ ok: true, skipped: "ja_enviado_ou_antigo" });

  const route = routePush(n.title);

  const { data: settings } = await admin
    .from("notification_settings" as never)
    .select("push_workouts, push_social, push_reminders, push_promotions")
    .eq("user_id", n.user_id)
    .maybeSingle();
  if (!pushAllowed(route.category, settings as never)) {
    return NextResponse.json({ ok: true, skipped: "preferencia" });
  }

  // anti-spam: mesmo tipo de aviso para a mesma pessoa, 1 push a cada 10 min
  const { count: recent } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", n.user_id)
    .eq("title", n.title)
    .neq("id", n.id)
    .gte("pushed_at" as never, new Date(Date.now() - SAME_TAG_COOLDOWN_MS).toISOString());
  if (recent) return NextResponse.json({ ok: true, skipped: "cooldown" });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const payload = JSON.stringify({
    title: n.title,
    body: n.body,
    url: `${base}${route.path}`,
    tag: route.tag,
  });
  const r = await sendPushToUser(admin, n.user_id, payload);
  return NextResponse.json({ ok: true, sent: r.sent });
}
