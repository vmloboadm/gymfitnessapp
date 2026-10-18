"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { useRealtime } from "~/hooks/useRealtime";

/**
 * "X pessoas treinando agora".
 * Conta pessoas distintas: sessões de equipamento ativas + check-ins de
 * entrada recentes (mesmo aluno em os dois conta uma vez).
 * Depois mantido "vivo" via Realtime das duas tabelas.
 * Só conta atividade das últimas 3h: registro travado não infla o número.
 */
export function useOnlineCount(gymId?: string) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const since = () => new Date(Date.now() - 3 * 3600000).toISOString();

  const recount = (gym: string) =>
    Promise.all([
      supabaseBrowser()
        .from("equipment_sessions")
        .select("student_id")
        .eq("gym_id", gym)
        .eq("status", "active")
        .gte("started_at", since())
        .limit(200),
      supabaseBrowser()
        .from("checkins")
        .select("student_id")
        .eq("gym_id", gym)
        .eq("type", "entrada")
        .gte("checked_at", since())
        .limit(200),
    ]).then(([sessRes, ciRes]) => {
      const ids = new Set<string>();
      for (const r of (sessRes.data ?? []) as Array<{ student_id: string }>) ids.add(r.student_id);
      for (const r of (ciRes.data ?? []) as Array<{ student_id: string }>) ids.add(r.student_id);
      return ids.size;
    });

  useEffect(() => {
    if (!gymId) return;
    let cancelled = false;

    recount(gymId)
      .then((c) => {
        if (!cancelled) {
          setCount(c);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCount(0);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  // Realtime: recalcula no insert/delete de sessão ou check-in
  useRealtime(
    `online-sess-${gymId}`,
    { table: "equipment_sessions", gymId },
    () => {
      if (!gymId) return;
      recount(gymId).then(setCount).catch(() => {});
    }
  );
  useRealtime(
    `online-ci-${gymId}`,
    { table: "checkins", gymId },
    () => {
      if (!gymId) return;
      recount(gymId).then(setCount).catch(() => {});
    }
  );

  return { count, loading };
}
