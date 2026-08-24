"use client";

import { useState, useEffect, useCallback } from "react";

type QueueAction = {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
  status: "pending" | "syncing" | "error";
  error?: string;
};

const STORAGE_KEY = "gf_offline_queue";

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueueAction[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setQueue(JSON.parse(raw) as QueueAction[]);
    } catch {
      /* noop */
    }
  }, []);

  const persist = useCallback((next: QueueAction[]) => {
    setQueue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage cheia */
    }
  }, []);

  /** Enfileira ação offline com idempotency key (previnir duplicidade no sync). */
  const enqueue = useCallback(
    (table: string, data: Record<string, unknown>) => {
      const action: QueueAction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        table,
        data,
        createdAt: Date.now(),
        status: "pending",
      };
      persist([...queue, action]);
    },
    [queue, persist]
  );

  /** Sincronização: jogar para a rota de API em ordem; remove os enviados. */
  const syncAll = useCallback(
    async (flushFn: (actions: QueueAction[]) => Promise<boolean>) => {
      if (queue.length === 0) return true;
      const ok = await flushFn(queue.map((a) => ({ ...a, status: "syncing" as const })));
      if (ok) persist([]);
      return ok;
    },
    [queue, persist]
  );

  return {
    queue,
    isOnline,
    pendingCount: queue.length,
    enqueue,
    syncAll,
  };
}