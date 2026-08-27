"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";

type QueueAction = {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
};

const STORAGE_KEY = "gf_offline_queue";

/**
 * Ouvinte de background sync (blueprint §5.5).
 * Quando o service worker entrega `SYNC_OFFLINE_QUEUE` (sync event), lê a fila
 * do localStorage e tenta o flush em /api/sync. Em sucesso limpa a fila.
 */
export function OfflineSyncListener() {
  useEffect(() => {
    const runSync = async () => {
      let queue: QueueAction[] = [];
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) queue = JSON.parse(raw) as QueueAction[];
      } catch {
        return;
      }
      if (queue.length === 0) return;

      try {
        const supabase = getSupabaseBrowser();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return; // sem sessão, não há como sincronizar com segurança

        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ actions: queue }),
        });
        if (res.ok) {
          window.localStorage.removeItem(STORAGE_KEY);
          logger.info("sync.flush_ok", { count: queue.length });
        } else {
          logger.warn("sync.flush_rejected", { status: res.status, count: queue.length });
        }
      } catch (err) {
        // offline de novo, mantém a fila para a próxima tentativa
        logger.warn("sync.flush_offline", { count: queue.length, err });
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_OFFLINE_QUEUE") {
        runSync();
      }
    };

    const onOnline = () => {
      runSync();
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}