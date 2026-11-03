import { supabaseAdmin } from "~/lib/supabase/admin";
import { BUILD_VERSION } from "~/lib/build";
import { describeError, fingerprintOf, normalizeEvent, type ErrorEvent } from "~/lib/monitoring/shared";

/**
 * Gravação dos erros na tabela app_errors (service role). SERVER-ONLY.
 * Falha de gravação nunca derruba quem chamou: monitoramento é best-effort.
 */

const RETENTION_DAYS = 60;

type Row = {
  source: "client" | "server";
  level: ErrorEvent["level"];
  event: string;
  message: string | null;
  stack: string | null;
  path: string | null;
  user_id: string | null;
  user_agent: string | null;
  build: string | null;
  fingerprint: string;
  extra: Record<string, unknown> | null;
};

export async function storeErrors(
  events: ErrorEvent[],
  ctx: { source: "client" | "server"; userId?: string | null; userAgent?: string | null; build?: string | null }
): Promise<void> {
  if (!events.length) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  const rows: Row[] = events.map((e) => ({
    source: ctx.source,
    level: e.level,
    event: e.event,
    message: e.message ?? null,
    stack: e.stack ?? null,
    path: e.path ?? null,
    user_id: ctx.userId ?? null,
    user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 300) : null,
    build: (ctx.build ?? BUILD_VERSION).slice(0, 40),
    fingerprint: fingerprintOf(e.event, e.message),
    extra: e.extra ?? null,
  }));

  try {
    // tabela fora dos tipos escritos à mão: cliente sem tipagem só aqui
    const db = supabaseAdmin() as unknown as {
      from: (t: string) => {
        insert: (r: Row[]) => PromiseLike<{ error: unknown }>;
        delete: () => { lt: (c: string, v: string) => PromiseLike<{ error: unknown }> };
      };
    };
    const { error } = await db.from("app_errors").insert(rows);
    if (error) console.warn("[gf:monitor] falha ao gravar erro", error);

    // limpeza ocasional (~2% das gravações) para a tabela não crescer sem fim
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      await db.from("app_errors").delete().lt("created_at", cutoff);
    }
  } catch (err) {
    console.warn("[gf:monitor] monitoramento indisponível", err);
  }
}

/** Atalho para código de servidor: grava um erro já capturado. */
export async function reportServerError(
  event: string,
  error: unknown,
  extra?: Record<string, unknown>,
  path?: string | null
): Promise<void> {
  const { message, stack } = describeError(error);
  const ev = normalizeEvent({ level: "error", event, message, stack, path, extra });
  if (ev) await storeErrors([ev], { source: "server" });
}
