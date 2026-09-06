import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/account/delete — exclusão total da conta pelo próprio usuário.
 *
 * Recebe JSON { password } + Authorization (JWT do usuário logado).
 * 1) Valida o JWT (só o dono exclui a própria conta).
 * 2) Confirma a senha (prova de posse — signIn com email+senha).
 * 3) Apaga todos os dados vinculados + profile + usuário auth (service_role).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SRK || !ANON) {
    return NextResponse.json({ ok: false, error: "Serviço indisponível." }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return NextResponse.json({ ok: false, error: "Sessão necessária." }, { status: 401 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Senha necessária." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, error: "Senha necessária." }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  }
  const user = userData.user;
  const userId = user.id;
  const email = user.email ?? "";

  // 2) prova de posse: senha precisa bater
  const checker = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await checker.auth.signInWithPassword({ email, password });
  if (signErr) {
    return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 403 });
  }

  // 3) apaga dados vinculados (ordem: filhas → profile → auth)
  const tables: [string, string][] = [
    ["checkins", "student_id"],
    ["workout_logs", "student_id"],
    ["student_workouts", "student_id"],
    ["workout_sessions", "student_id"],
    ["equipment_sessions", "student_id"],
    ["premium_requests", "student_id"],
    ["body_metrics", "student_id"],
    ["leaderboard", "student_id"],
    ["student_achievements", "student_id"],
    ["student_trainers", "student_id"],
    ["student_subscriptions", "student_id"],
    ["medical_clearances", "student_id"],
    ["notifications", "user_id"],
    ["feed_likes", "user_id"],
    ["feed_comments", "user_id"],
    ["squad_members", "user_id"],
    ["notification_settings", "user_id"],
    ["feed_posts", "author_id"],
  ];
  for (const [table, col] of tables) {
    try {
      await admin.from(table).delete().eq(col, userId);
    } catch {
      /* tabela pode não ter a coluna — segue */
    }
  }
  try {
    await admin.from("profiles").delete().eq("id", userId);
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao remover perfil." }, { status: 500 });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: "Falha ao remover conta." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
