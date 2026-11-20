"use client";

import { supabaseBrowser } from "~/lib/supabase/client";

/** Resposta de public.home_snapshot (migration 092). */
export type HomeSnapshot = {
  checkin_today: { id: string; checked_at: string; type: string } | null;
  logs: Array<{ date: string; exercise_id: string | null; weight_kg: number | null; reps: number | null }>;
  board: Array<{ student_id: string; points: number }>;
  completed_today: boolean;
  streak: number | null;
  motivation: string | null;
};

let inflight: { key: string; at: number; p: Promise<HomeSnapshot> } | null = null;

/**
 * Uma ida ao banco para a Home inteira. Chamadas que chegam juntas (mesmo
 * dia, mesmo aluno, dentro de 1,5 s) compartilham a resposta.
 */
export function fetchHomeSnapshot(dayStartISO: string): Promise<HomeSnapshot> {
  const now = Date.now();
  if (inflight && inflight.key === dayStartISO && now - inflight.at < 1500) return inflight.p;
  const p = (async () => {
    const { data, error } = await supabaseBrowser().rpc("home_snapshot" as never, { p_day_start: dayStartISO } as never);
    if (error) throw new Error(error.message);
    return (data ?? {}) as HomeSnapshot;
  })();
  inflight = { key: dayStartISO, at: now, p };
  return p;
}
