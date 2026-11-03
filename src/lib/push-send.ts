/**
 * Entrega server-only de notificações: grava em `notifications` (histórico
 * in-app) e envia Web Push best-effort para as assinaturas de cada usuário.
 * Usado por /api/push/send e /api/notify/workout-done.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { logger } from "~/lib/logger";

let vapidReady = false;

function ensureVapidDetails(): boolean {
  if (vapidReady) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    logger.warn("push.vapid_missing");
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return true;
  } catch (err) {
    logger.error("push.vapid_invalid", err);
    return false;
  }
}

export type DeliverResult = {
  sent: number;
  /** diagnostico quando sent=0: qtd de assinaturas, vapid ok e ultimo erro */
  diag?: { subs: number; vapid: boolean; lastError: string | null };
};

/**
 * Envia um push (já montado) para todas as assinaturas de um usuário.
 * Assinatura expirada (404/410) é removida na hora. Nunca lança.
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: string
): Promise<{ sent: number; subs: number; vapid: boolean; lastError: string | null }> {
  const vapidDetails = {
    subject: process.env.VAPID_SUBJECT ?? "",
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
  let sent = 0;
  let lastError: string | null = null;
  let vapidOk = false;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  for (const sub of subs ?? []) {
    vapidOk = ensureVapidDetails();
    if (!vapidOk) {
      lastError = lastError ?? "vapid indisponivel";
      continue;
    }
    try {
      // web-push 3.x exige objeto {endpoint, keys} (string pura lanca erro)
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { vapidDetails }
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `status=${status} ${msg}`.slice(0, 240);
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      logger.warn("push.send_failed", { status, userId });
    }
  }
  return { sent, subs: (subs ?? []).length, vapid: vapidOk, lastError };
}

/**
 * Insere o histórico in-app e envia push para cada usuário.
 * Best-effort: falha de um assinante não derruba os outros.
 * O aviso já nasce com pushed_at: o despacho automático do banco
 * (/api/push/dispatch) não manda de novo.
 */
export async function deliverNotification(
  admin: SupabaseClient,
  opts: { gymId: string; userIds: string[]; title: string; body: string; url?: string }
): Promise<DeliverResult> {
  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/app",
  });
  let sent = 0;
  let subsTotal = 0;
  let lastError: string | null = null;
  let vapidOk = false;

  for (const userId of opts.userIds) {
    await admin
      .from("notifications")
      .insert({
        gym_id: opts.gymId,
        user_id: userId,
        channel: "in_app",
        title: opts.title,
        body: opts.body,
        pushed_at: new Date().toISOString(),
      } as never);

    const r = await sendPushToUser(admin, userId, payload);
    sent += r.sent;
    subsTotal += r.subs;
    vapidOk = vapidOk || r.vapid;
    lastError = r.lastError ?? lastError;
  }

  if (sent === 0) {
    return { sent, diag: { subs: subsTotal, vapid: vapidOk, lastError } };
  }
  return { sent };
}
