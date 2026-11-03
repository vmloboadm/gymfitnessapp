"use client";

import { apiPath } from "~/lib/api-path";
import { BUILD_VERSION } from "~/lib/build";
import { describeError, fingerprintOf, type ErrorEvent, type ErrorLevel } from "~/lib/monitoring/shared";

/**
 * Coletor de erros no navegador: junta em lote e manda para /api/errors.
 * - mesma falha (fingerprint) só sobe 1x a cada 60s por aba;
 * - no máximo 40 eventos por carregamento de página;
 * - ao esconder a aba, envia o que sobrou via sendBeacon.
 * Nunca lança: se o envio falhar, o erro é descartado.
 */

const DEDUPE_MS = 60_000;
const MAX_PER_PAGE = 40;
const FLUSH_DELAY = 2_000;

const queue: ErrorEvent[] = [];
const lastSent = new Map<string, number>();
let sentThisPage = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setMonitorTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

function currentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

export function captureClient(
  level: ErrorLevel,
  event: string,
  error?: unknown,
  extra?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  try {
    const { message, stack } = error === undefined ? { message: "", stack: null } : describeError(error);
    const fp = fingerprintOf(event, message);
    const now = Date.now();
    if ((lastSent.get(fp) ?? 0) > now - DEDUPE_MS) return;
    if (sentThisPage >= MAX_PER_PAGE) return;
    lastSent.set(fp, now);
    sentThisPage++;

    queue.push({ level, event, message, stack, path: currentPath(), extra: extra ?? null });
    if (!timer) timer = setTimeout(() => void flush(), FLUSH_DELAY);
  } catch {
    /* monitoramento nunca quebra o app */
  }
}

async function payload(): Promise<string | null> {
  if (!queue.length) return null;
  const events = queue.splice(0, 10);
  let token: string | null = null;
  try {
    token = tokenGetter ? await tokenGetter() : null;
  } catch {
    token = null;
  }
  return JSON.stringify({ events, build: BUILD_VERSION, token });
}

export async function flush(): Promise<void> {
  timer = null;
  const body = await payload();
  if (!body) return;
  try {
    await fetch(apiPath("/api/errors"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* offline: descarta */
  }
  if (queue.length) timer = setTimeout(() => void flush(), FLUSH_DELAY);
}

/** Envio final ao fechar/esconder a aba (sem esperar token novo). */
export function flushOnHide() {
  if (!queue.length) return;
  const events = queue.splice(0, 10);
  const body = JSON.stringify({ events, build: BUILD_VERSION });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.(apiPath("/api/errors"), blob)) {
      void fetch(apiPath("/api/errors"), { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* ignora */
  }
}
