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

export type DeliverResult = { sent: number };

/**
 * Insere o histórico in-app e envia push para cada usuário.
 * Best-effort: falha de um assinante não derruba os outros.
 * Assinatura expirada (404/410) é removida na hora.
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
  const vapidDetails = {
    subject: process.env.VAPID_SUBJECT ?? "",
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
  let sent = 0;

  for (const userId of opts.userIds) {
    await admin
      .from("notifications")
      .insert({
        gym_id: opts.gymId,
        user_id: userId,
        channel: "in_app",
        title: opts.title,
        body: opts.body,
      } as never);

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    for (const sub of subs ?? []) {
      if (!ensureVapidDetails()) continue;
      try {
        await webpush.sendNotification(sub.endpoint, payload, { vapidDetails });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        logger.warn("push.send_failed", { status, userId });
      }
    }
  }

  return { sent };
}
