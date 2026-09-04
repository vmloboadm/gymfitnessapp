"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { logger } from "~/lib/logger";

type QueueAction = {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
  /** Contagem de tentativas (backoff exponencial) */
  retries?: number;
};

type SyncResult = { id: string; ok: boolean; error: string | null };

const STORAGE_KEY = "gf_offline_queue";
const DEAD_LETTER_KEY = "gf_offline_dead_letter";
const MAX_RETRIES = 5;

/**
 * Ouvinte de background sync (blueprint §5.5).
 * v2: Removeção seletiva (só itens sincronizados), backoff exponencial,
 * dead-letter para itens com 3+ falhas, idempotência por action_id.
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
        if (!token) return;

        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ actions: queue }),
        });

        if (res.ok) {
          // 200: tudo sincronizado
          window.localStorage.removeItem(STORAGE_KEY);
          logger.info("sync.flush_ok", { count: queue.length });
          return;
        }

        if (res.status === 207) {
          // 207: resposta parcial — parseia resultados
          const body = await res.json() as { results?: SyncResult[] };
          const results = body.results ?? [];

          const syncedIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
          const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.id));

          // Itens que não tinham resposta (servidor não processou) = mantém
          const remaining: QueueAction[] = [];
          const deadLetter: QueueAction[] = [];

          for (const item of queue) {
            if (syncedIds.has(item.id)) {
              // Sincronizado: remove da fila
              continue;
            }
            if (failedIds.has(item.id)) {
              // Falhou: incrementa retries
              const retries = (item.retries ?? 0) + 1;
              if (retries >= MAX_RETRIES) {
                // Move para dead-letter
                deadLetter.push({ ...item, retries });
                logger.warn("sync.dead_letter", { id: item.id, table: item.table, retries });
              } else {
                remaining.push({ ...item, retries });
              }
            } else {
              // Sem resposta: mantém (pode ter sido perdido na rede)
              remaining.push(item);
            }
          }

          // Salva fila restante
          if (remaining.length > 0) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }

          // Salva dead-letter
          if (deadLetter.length > 0) {
            try {
              const existing = JSON.parse(
                window.localStorage.getItem(DEAD_LETTER_KEY) ?? "[]"
              ) as QueueAction[];
              window.localStorage.setItem(
                DEAD_LETTER_KEY,
                JSON.stringify([...existing, ...deadLetter])
              );
            } catch {
              window.localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(deadLetter));
            }
          }

          logger.info("sync.flush_partial", {
            synced: syncedIds.size,
            failed: failedIds.size,
            remaining: remaining.length,
            deadLettered: deadLetter.length,
          });
          return;
        }

        // Outro status: mantém fila para retry
        logger.warn("sync.flush_rejected", { status: res.status, count: queue.length });
      } catch (err) {
        // Offline de novo: mantém fila com backoff
        logger.warn("sync.flush_offline", { count: queue.length, err });
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_OFFLINE_QUEUE") {
        runSync();
      }
    };

    const onOnline = () => {
      // Delay para garantir que a conexão estabilizou
      setTimeout(runSync, 1000);
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);

    // Sync periódico (a cada 60s se online)
    const interval = setInterval(() => {
      if (navigator.onLine) runSync();
    }, 60000);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, []);

  return null;
}
