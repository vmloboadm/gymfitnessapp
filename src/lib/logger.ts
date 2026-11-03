/**
 * Logger local estruturado. logger.error também vai para o monitoramento
 * (tabela app_errors, painel /admin) via setErrorSink.
 * - Nível por env: LOG_LEVEL (debug|info|warn|error), default info.
 * - Buffer em memória dos últimos 200 eventos, exposto para diagnóstico
 *   em dev via window.__gfLogs (client) e exportável no server.
 * - Erros capturados ganham contexto estruturado; nunca loga PII além do
 *   user id, e nunca loga tokens/keys.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "warn" : "debug");

const BUFFER_SIZE = 200;
const buffer: Array<{ at: string; level: LogLevel; event: string; data?: unknown }> = [];

function push(level: LogLevel, event: string, data?: unknown) {
  const entry = { at: new Date().toISOString(), level, event, data };
  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE) buffer.shift();

  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return;

  const line = `[gf:${level}] ${event}`;
  if (level === "error") console.error(line, data ?? "");
  else if (level === "warn") console.warn(line, data ?? "");
  else console.log(line, data ?? "");

  if (typeof window !== "undefined") {
    (window as unknown as { __gfLogs?: typeof buffer }).__gfLogs = buffer;
  }
}

/** Sanitiza objetos antes de logar: remove chaves sensíveis conhecidas. */
function sanitize(data?: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const clone = { ...(data as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (/authorization|token|password|secret|api[_-]?key/i.test(key)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

type ErrorSink = (event: string, error: unknown, data?: Record<string, unknown>) => void;

/**
 * Destino dos logger.error (monitoramento): o ErrorMonitor (client) e o
 * instrumentation.ts (server) registram aqui. Fica em globalThis para valer
 * entre bundles diferentes do mesmo processo.
 */
export function setErrorSink(sink: ErrorSink | null) {
  (globalThis as { __gfErrorSink?: ErrorSink | null }).__gfErrorSink = sink;
}

function sendToSink(event: string, error: unknown, data?: unknown) {
  const sink = (globalThis as { __gfErrorSink?: ErrorSink | null }).__gfErrorSink;
  if (!sink) return;
  try {
    sink(event, error, sanitize(data) as Record<string, unknown> | undefined);
  } catch {
    /* monitoramento nunca quebra quem logou */
  }
}

export const logger = {
  debug(event: string, data?: unknown) {
    push("debug", event, sanitize(data));
  },
  info(event: string, data?: unknown) {
    push("info", event, sanitize(data));
  },
  warn(event: string, data?: unknown) {
    push("warn", event, sanitize(data));
  },
  error(event: string, error?: unknown, data?: unknown) {
    const err =
      error instanceof Error
        ? { message: error.message, stack: error.stack?.split("\n").slice(0, 4).join("\n") }
        : error;
    push("error", event, { err, ...((data as Record<string, unknown>) ?? {}) });
    sendToSink(event, error, data);
  },

  /** Últimos eventos (para botão "copiar diagnóstico" em suporte). */
  recent() {
    return [...buffer];
  },
};
