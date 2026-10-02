"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, TRACKED_PATHS } from "~/lib/analytics";

/**
 * Registra visita às LPs dos banners (QR da parede) e cliques nos CTAs.
 *
 * - pageview: monta/ Troca de rota em path rastreado (TRACKED_PATHS).
 * - click: delegação de clique em links que saem pra /register, /login
 *   ou /day-pass — é o "clique no banner" que o dono quer acompanhar.
 *
 * Um único listener por aba; efeitos limpos no unmount.
 */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (TRACKED_PATHS.has(pathname)) trackEvent("view", { path: pathname });
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (typeof window === "undefined") return;
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      const dest = href.split(/[?#]/)[0];
      if (dest !== "/register" && dest !== "/login" && dest !== "/day-pass") return;
      // só conta clique vindo de uma LP de banner (origem identificável)
      if (!TRACKED_PATHS.has(window.location.pathname)) return;
      trackEvent("click", { path: window.location.pathname, cta: dest });
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
