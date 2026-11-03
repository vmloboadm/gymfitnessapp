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

export type PushEnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "denied" | "dismissed" | "no_key" | "sw_timeout" | "subscribe_failed" | "no_session" | "server";
      detail?: string;
    };

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: sem resposta em ${ms / 1000}s`)), ms)),
  ]);
}

/** Pede a permissão. Safari antigo só aceita callback; os outros, Promise. */
function askPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    try {
      const r = Notification.requestPermission((p) => resolve(p));
      if (r && typeof (r as Promise<NotificationPermission>).then === "function") {
        (r as Promise<NotificationPermission>).then(resolve, () => resolve(Notification.permission));
      }
    } catch {
      resolve(Notification.permission);
    }
  });
}

/** Service worker pronto; registra de novo se ainda não houver nenhum. */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const existing = await navigator.serviceWorker.getRegistration(`${base}/`);
  if (!existing) await navigator.serviceWorker.register(`${base}/sw.js`);
  return withTimeout(navigator.serviceWorker.ready, 15_000, "service worker");
}

/**
 * Liga o push neste aparelho. IMPORTANTE: chamar direto no toque do botão —
 * o pedido de permissão é a PRIMEIRA coisa feita, antes de qualquer espera
 * (Safari/Firefox só mostram o pedido dentro do gesto do usuário).
 */
export async function enablePush(): Promise<PushEnableResult> {
  if (!isPushSupported() || typeof Notification === "undefined") return { ok: false, reason: "unsupported" };
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: "no_key" };

  const permission = Notification.permission === "granted" ? "granted" : await askPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  let reg: ServiceWorkerRegistration;
  try {
    reg = await readyRegistration();
  } catch (err) {
    return { ok: false, reason: "sw_timeout", detail: String(err) };
  }

  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await withTimeout(
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toApplicationServerKey(publicKey) }),
        20_000,
        "assinatura"
      ));
  } catch (err) {
    return { ok: false, reason: "subscribe_failed", detail: String(err) };
  }

  const json = sub.toJSON();
  const token = await accessToken();
  if (!token) return { ok: false, reason: "no_session" };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "subscribe_failed", detail: "assinatura sem chaves" };
  }

  try {
    const res = await withTimeout(
      fetch(apiPath("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
      }),
      15_000,
      "servidor"
    );
    if (!res.ok) return { ok: false, reason: "server", detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: "server", detail: String(err) };
  }
  return { ok: true };
}

/** Compat: versão booleana usada por telas antigas. */
export async function subscribePush(): Promise<boolean> {
  return (await enablePush()).ok;
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
