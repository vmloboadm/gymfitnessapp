"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useRealtime } from "~/hooks/useRealtime";

/**
 * "X pessoas treinando agora".
 * Baseline = query inicial; depois mantido "vivo" via Realtime
 * (contagem de equipment_sessions ativas por gym).
 * Só conta sessões iniciadas há menos de 3h: sessão travada (app fechado
 * sem finalizar) não infla o número.
 */
export function useOnlineCount(gymId?: string) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const since = () => new Date(Date.now() - 3 * 3600000).toISOString();

  useEffect(() => {
    if (!gymId) return;
    let cancelled = false;

    supabaseBrowser()
      .from("equipment_sessions")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("status", "active")
      .gte("started_at", since())
      .then(({ count: c }) => {
        if (!cancelled) {
          setCount(c ?? 0);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gymId]);

  // Realtime: recalcula no insert/delete de sessão
  useRealtime(
    `online-${gymId}`,
    { table: "equipment_sessions", gymId },
    () => {
      if (!gymId) return;
      supabaseBrowser()
        .from("equipment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gymId)
        .eq("status", "active")
        .gte("started_at", since())
        .then(({ count: c }) => setCount(c ?? 0));
    }
  );

  return { count, loading };
}