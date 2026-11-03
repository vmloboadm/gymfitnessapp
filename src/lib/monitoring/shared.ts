/**
 * Formato comum de um evento de erro (client e server) e limpeza antes de
 * gravar. Nunca guarda tokens/senhas; corta tudo para caber num registro.
 */

export type ErrorLevel = "error" | "toast";

export type ErrorEvent = {
  level: ErrorLevel;
  event: string;
  message?: string | null;
  stack?: string | null;
  path?: string | null;
  extra?: Record<string, unknown> | null;
};

const LIMITS = { event: 120, message: 1000, stack: 4000, path: 300, extra: 2000 };

const SECRET_KEY = /authorization|token|password|senha|secret|api[_-]?key|cookie/i;
// JWTs e chaves longas que escapem dentro de mensagens
const SECRET_VALUE = /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|(sk|pk|service)_[\w-]{16,}/g;

export function clip(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).replace(SECRET_VALUE, "[redacted]");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function cleanExtra(extra: unknown): Record<string, unknown> | null {
  if (!extra || typeof extra !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (SECRET_KEY.test(k)) continue;
    if (v == null || ["string", "number", "boolean"].includes(typeof v)) {
      out[k] = typeof v === "string" ? clip(v, 300) : v;
    } else {
      out[k] = clip(safeJson(v), 300);
    }
  }
  const json = safeJson(out);
  return json.length > LIMITS.extra ? { truncated: clip(json, LIMITS.extra) } : out;
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return String(v);
  }
}

/** Agrupa ocorrências iguais: evento + mensagem sem números/ids. */
export function fingerprintOf(event: string, message?: string | null): string {
  const norm = (message ?? "")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>")
    .replace(/\d+/g, "0")
    .slice(0, 200);
  return `${event}|${norm}`;
}

export function normalizeEvent(raw: unknown): ErrorEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const event = clip(r.event, LIMITS.event);
  if (!event) return null;
  return {
    level: r.level === "toast" ? "toast" : "error",
    event,
    message: clip(r.message, LIMITS.message),
    stack: clip(r.stack, LIMITS.stack),
    path: clip(r.path, LIMITS.path),
    extra: cleanExtra(r.extra),
  };
}

/** Converte qualquer coisa lançada em mensagem + stack legíveis. */
export function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? null };
  }
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    // erros do Supabase/PostgREST: { message, code, details, hint }
    const parts = [o.code, o.message, o.details, o.hint].filter(Boolean).map(String);
    if (parts.length) return { message: parts.join(" · "), stack: null };
    return { message: safeJson(error), stack: null };
  }
  return { message: String(error), stack: null };
}
