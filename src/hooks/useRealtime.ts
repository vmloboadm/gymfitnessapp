"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";

type OnEvent = (payload: {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}) => void;

/**
 * Subscribe num canal Realtime do Supabase.
 * - Sempre filtra por gym_id (REGRA 0.1)
 * - Desconecta no unmount (memory leak é bug, ver blueprint §5.4)
 */
export function useRealtime(
  channelName: string,
  config: {
    table: string;
    gymId?: string;
    filterCol?: string;
  },
  onEvent: OnEvent
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    // Sem gymId não assina: evita canais `*-undefined` sem filtro (vazamento cross-gym)
    if (!config.gymId) return;
    const supabase = supabaseBrowser();
    const filter = config.gymId
      ? `${config.filterCol ?? "gym_id"}=eq.${config.gymId}`
      : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: config.table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          handlerRef.current({
            eventType: payload.eventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, config.table, config.gymId, config.filterCol]);
}