type OfflineQueueItem = {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
};

const STORAGE_KEY = "gf_offline_queue";

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function readQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function offlineQueueCount(): number {
  return readQueue().length;
}

export function hasOfflineItems(): boolean {
  return readQueue().length > 0;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Enfileira uma escrita no mesmo formato que o OfflineSyncListener sincroniza
 * (POST /api/sync). O row.id vira uuid no enqueue: se o flush falhar depois
 * de o insert já ter entrado, o retry morre em conflito de PK e não duplica.
 * Retorna false quando o storage encheu e nada foi salvo.
 */
export function enqueueOffline(table: string, data: Record<string, unknown>): boolean {
  if (typeof window === "undefined") return false;
  const rowId = typeof data.id === "string" && data.id.length > 0 ? data.id : uuid();
  const row = rowId === data.id ? data : { ...data, id: rowId };
  try {
    const queue = readQueue();
    if (queue.some((a) => a.table === table && a.data?.id === rowId)) return true;
    queue.push({ id: uuid(), table, data: row, createdAt: Date.now() });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event("gf_offline_queue"));
    return true;
  } catch {
    return false;
  }
}

/** Espelha o insert de submitRequest (gym-api) para enfileirar o mesmo pedido. */
export function enqueuePremiumRequest(opts: {
  gymId: string;
  userId: string;
  type: "premium" | "carga" | "relatorio" | "ajuste";
  message: string;
}): boolean {
  return enqueueOffline("premium_requests", {
    gym_id: opts.gymId,
    student_id: opts.userId,
    request_type: opts.type === "premium" || opts.type === "relatorio" ? "report" : "other",
    details: `[${opts.type}] ${opts.message}`,
    status: "pending",
  });
}

/** Falha de rede (fetch/Supabase offline) versus erro de regra do servidor. */
export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /fetch|network|load failed|failed to send|err_connection|econn|etimedout/i.test(msg);
}
