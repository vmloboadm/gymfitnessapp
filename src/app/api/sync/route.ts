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
 * POST /api/sync, flush da fila offline (blueprint §5.5).
 * SEGURANÇA: autentica o JWT do chamador e aplica inserts com o token dele
 * (RLS vigora). NUNCA usa service_role em rota aberta, nem confia em
 * student_id/gym_id vindos do cliente.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase não configurado.", synced: 0 },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado.", synced: 0 },
      { status: 401 }
    );
  }

  // Cliente enxerga apenas para validar o token (auth.getUser ignora RLS).
  const verifier = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await verifier.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, error: "Sessão inválida ou expirada.", synced: 0 },
      { status: 401 }
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

  // Cap de trabalho por request: evita streaming de milhares de inserts
  if (actions.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Lote muito grande. Envie no máximo 100 ações por request.", synced: 0 },
      { status: 413 }
    );
  }

  const invalid = actions.filter((a) => !ALLOWED_TABLES.includes(a.table));
  if (invalid.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Tabela não permitida: ${invalid[0].table}` },
      { status: 400 }
    );
  }

  // Inserts rodam com o JWT do usuário: RLS garante que ele só escreve
  // nos próprios registros da própria academia (student_id/gym_id forjados
  // são rejeitados pelas policies).
  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
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