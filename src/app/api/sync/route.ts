import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/types/database";

type SyncAction = {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
  status: "pending" | "syncing" | "error";
};

const ALLOWED_TABLES = [
  "workout_logs",
  "body_metrics",
  "checkins",
  "feed_posts",
  "feed_likes",
  "feed_comments",
  "squad_messages",
  "premium_requests",
  "notifications",
  "equipment_sessions",
];

/**
 * POST /api/sync — flush da fila offline (blueprint §5.5).
 * Recebe a lista de ações e aplica sobre o banco em ordem, com checagem de
 * tabela permitida (nunca confia no cliente). Sem service role configurado,
 * retorna erro estrutural (fallback honesto, sem falsa sensação de sucesso).
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada — sincronização offline indisponível.",
        synced: 0,
      },
      { status: 503 }
    );
  }

  let body: { actions?: SyncAction[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const actions = (body.actions ?? []).filter(
    (a): a is SyncAction =>
      !!a &&
      typeof a === "object" &&
      typeof a.id === "string" &&
      typeof a.table === "string" &&
      typeof a.data === "object"
  );

  const invalid = actions.filter((a) => !ALLOWED_TABLES.includes(a.table));
  if (invalid.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Tabela não permitida: ${invalid[0].table}` },
      { status: 400 }
    );
  }

  const supabase = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Array<{ id: string; ok: boolean; error: string | null }> = [];
  for (const action of actions) {
    const { error } = await supabase
      .from(action.table as keyof Database["public"]["Tables"])
      .insert(action.data as never);
    results.push({
      id: action.id,
      ok: !error,
      error: error?.message ?? null,
    });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    {
      ok: failed.length === 0,
      synced: results.length - failed.length,
      failed: failed.length,
      results,
    },
    failed.length === 0 ? { status: 200 } : { status: 207 }
  );
}