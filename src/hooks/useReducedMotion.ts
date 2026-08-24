"use client";

import { useEffect, useState } from "react";

/**
 * Detecta `prefers-reduced-motion` (aparelhos fracos / acessibilidade).
 * Componentes com animações infinitas devem pausá-las quando `true`.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}
