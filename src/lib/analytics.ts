"use client";

/**
 * Rastreio leve dos QR dos banners da parede (page_views).
 *
 * Cada banner tem um QR caindo numa LP pública diferente, então o `path`
 * já identifica o banner. `visitor_id` (uuid anônimo por device) permite
 * contar visitantes únicos e fechar o funil: banner → clique → cadastro.
 *
 * Regras:
 *  - fire-and-forget: nunca quebra a página se o insert falhar;
 *  - pula em modo demo (NEXT_PUBLIC_DEMO_MODE=1);
 *  - 1 evento por path+kind por janela de 15s (evita duplo mount/StrictMode).
 */

import { supabaseBrowser } from "~/lib/supabase/client";

const VISITOR_KEY = "gf_visitor_id";
const SENT_KEY = "gf_pv_sent";
const WINDOW_MS = 15_000;

export type PageEventKind = "view" | "click" | "signup" | "daypass";

/** LPs públicas dos banners (rastreadas por pageview automático). */
export const TRACKED_PATHS = new Set([
  "/bem-vindo",
  "/parceiros",
  "/evolucao",
  "/vantagens",
  "/day-pass",
  "/register",
  "/login",
]);

function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

/** uuid anônimo por device (localStorage; fallback em memória). */
let memVisitor: string | null = null;
export function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const saved = window.localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const gen = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, gen);
    return gen;
  } catch {
    if (!memVisitor) memVisitor = crypto.randomUUID();
    return memVisitor;
  }
}

function deviceKind(): "mobile" | "desktop" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

/** Dedupe por janela: mesmo path+kind em menos de 15s = ignora. */
function shouldSend(path: string, kind: PageEventKind, cta?: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `${path}|${kind}|${cta ?? ""}`;
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const sent: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const last = sent[key] ?? 0;
    if (Date.now() - last < WINDOW_MS) return false;
    sent[key] = Date.now();
    // mantém só as 40 entradas mais recentes
    const entries = Object.entries(sent).sort((a, b) => b[1] - a[1]).slice(0, 40);
    window.localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(entries)));
    return true;
  } catch {
    return true; // sem storage: manda mesmo assim
  }
}

/**
 * Registra um evento do funil dos banners. Fire-and-forget.
 * `path` default = página atual; `cta` = destino do clique.
 */
export function trackEvent(
  kind: PageEventKind,
  opts?: { path?: string; cta?: string }
): void {
  if (isDemo() || typeof window === "undefined") return;
  const path = opts?.path ?? window.location.pathname;
  const cta = opts?.cta;
  if (!shouldSend(path, kind, cta)) return;

  const vid = visitorId();
  if (!vid) return;

  supabaseBrowser()
    .from("page_views")
    .insert({
      path,
      kind,
      cta: cta ?? null,
      referrer: (document.referrer || "").slice(0, 300) || null,
      device: deviceKind(),
      visitor_id: vid,
    } as never)
    .then(() => {}, () => {});
}

/** Conversão com user_id (chamar após o signup dar certo). */
export function trackConversion(kind: "signup" | "daypass", userId?: string): void {
  if (isDemo() || typeof window === "undefined") return;
  const path = window.location.pathname;
  if (!shouldSend(path, kind)) return;
  const vid = visitorId();
  if (!vid) return;

  supabaseBrowser()
    .from("page_views")
    .insert({
      path,
      kind,
      referrer: (document.referrer || "").slice(0, 300) || null,
      device: deviceKind(),
      visitor_id: vid,
      user_id: userId ?? null,
    } as never)
    .then(() => {}, () => {});
}
