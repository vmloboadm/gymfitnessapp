import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "~/lib/logger";

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

async function removeStorageFolder(admin: SupabaseClient, bucket: string, folder: string) {
  try {
    const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    const files = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (files.length) await admin.storage.from(bucket).remove(files);
  } catch (err) {
    logger.error("account.delete_storage", err);
  }
}

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

  // 3) apaga todos os dados + profile numa transação só (migration 064).
  // O supabase-js não lança exceção: o erro vem no retorno e precisa ser checado.
  const { error: dataErr } = await admin.rpc("delete_user_data" as never, { p_user: userId } as never);
  if (dataErr) {
    logger.error("account.delete_data", dataErr);
    return NextResponse.json({ ok: false, error: "Falha ao remover os dados da conta." }, { status: 500 });
  }

  // 4) arquivos no storage (fotos e laudos). Falha aqui não bloqueia a exclusão.
  await removeStorageFolder(admin, "avatars", userId);
  await removeStorageFolder(admin, "avatars", `progress/${userId}`);
  await removeStorageFolder(admin, "medical", `clearances/${userId}`);

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: "Falha ao remover conta." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
