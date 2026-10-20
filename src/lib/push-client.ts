/**
 * Cliente Web Push (browser): subscribe/unsubscribe da assinatura e
 * disparo de notificação para a equipe. Usa o session token do Supabase.
 */

import { supabaseBrowser } from "~/lib/supabase/client";
import { apiPath } from "~/lib/api-path";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function toApplicationServerKey(key: string): BufferSource {
  return urlBase64ToUint8Array(key) as unknown as BufferSource;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabaseBrowser().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Assina o push no browser e registra a assinatura no servidor. */
export async function subscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toApplicationServerKey(publicKey),
  });
  const json = sub.toJSON();
  const token = await accessToken();
  if (!token || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const res = await fetch(apiPath("/api/push/subscribe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  return res.ok;
}

/** Remove a assinatura do browser e do servidor. */
export async function unsubscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  const token = await accessToken();
  if (token) {
    await fetch(apiPath("/api/push/unsubscribe"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    }).catch(() => null);
  }
  return true;
}

/** Dispara notificação in-app + push para a equipe (usado pelo gym-api). */
export async function notifyStaffPush(
  userIds: string[],
  title: string,
  body: string,
  url?: string
): Promise<boolean> {
  if (userIds.length === 0) return false;
  const token = await accessToken();
  if (!token) return false;

  const res = await fetch(apiPath("/api/push/send"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userIds: userIds.slice(0, 50), title, body, url }),
  });
  return res.ok;
}
