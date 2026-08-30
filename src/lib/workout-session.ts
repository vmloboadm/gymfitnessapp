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

export const MAX_SESSION_HOURS = 4;
export const SESSION_WARN_HOURS = 2; // sessão órfã (celular reiniciou, esqueceu de finalizar) expira sozinha

function read(): WorkoutSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutSession;
    if (typeof parsed?.startedAt !== "number" || !Number.isFinite(parsed.startedAt)) return null;
    const hours = (Date.now() - parsed.startedAt) / 3600000;
    if (hours > MAX_SESSION_HOURS) {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(EVENT));
      return null;
    }
    return parsed;
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

/** Fase da sessão para UI: normal <2h · alerta >=2h · null já expirou (>=4h). */
export function sessionPhase(startedAt: number, now: number): "ativa" | "alerta" | "expirada" | null {
  const hours = (now - startedAt) / 3600000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  if (hours >= MAX_SESSION_HOURS) return "expirada";
  if (hours >= SESSION_WARN_HOURS) return "alerta";
  return "ativa";
}

// ---------------------------------------------------------------------------
// Progresso da sessão em execução (séries marcadas) — sobrevive à navegação:
// o aluno pode circular pelo app com o treino rolando e voltar sem perder nada.
// Guardado junto da sessão-do-dia; expira com ela (4h) e limpa ao finalizar.
// ---------------------------------------------------------------------------

const KEY_PROGRESS = "gymfit_session_progress_v1";

export type SavedExerciseProgress = {
  exercises: unknown[];
  progress: Record<string, { sets: Array<{ reps: string; done: boolean }> }>;
  currentIdx: number;
  savedAt: number;
};

export function saveSessionProgress(data: Omit<SavedExerciseProgress, "savedAt">): void {
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {}
}

export function readSessionProgress(): SavedExerciseProgress | null {
  try {
    const raw = localStorage.getItem(KEY_PROGRESS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedExerciseProgress;
    if (!parsed?.exercises?.length || typeof parsed.currentIdx !== "number") return null;
    // expira junto com a sessão do dia (4h)
    if (!read() || Date.now() - parsed.savedAt > MAX_SESSION_HOURS * 3600000) {
      localStorage.removeItem(KEY_PROGRESS);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionProgress(): void {
  try {
    localStorage.removeItem(KEY_PROGRESS);
  } catch {}
}
