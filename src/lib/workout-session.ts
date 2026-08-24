"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * FONTE ÚNICA da sessão de treino do dia (gate por scan).
 * Gravado SOMENTE após leitura validada (QR/NFC ou simulação demo).
 * Home, Treino e Checkin leem daqui — sincronizado entre abas via eventos.
 */

export type WorkoutSession = { startedAt: number };

const KEY = "gymfit_session_v1";
const EVENT = "gymfit-session";

function read(): WorkoutSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutSession;
    return typeof parsed?.startedAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function write(s: WorkoutSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Inicia a sessão APENAS após scan/leitura validada. */
export function startWorkoutSession() {
  write({ startedAt: Date.now() });
}

/** Encerra e limpa em todas as telas. */
export function endWorkoutSession() {
  write(null);
}

/** Hook reativo para qualquer tela. */
export function useWorkoutSession() {
  const [session, setSession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    const sync = () => setSession(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const start = useCallback(() => startWorkoutSession(), []);
  const end = useCallback(() => endWorkoutSession(), []);
  return { session, start, end };
}

export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatMMSS(totalSec: number): string {
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}
