import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tokenFromRequest } from "~/lib/auth-guard";

/**
 * POST /api/staff/reset-link — gera um link de redefinição de senha para um
 * aluno do MESMO gym, sem depender do envio de e-mail do Supabase (o SITE_URL
 * do projeto aponta para localhost, então o link automático não volta certo).
 *
 * O staff copia o link e manda no WhatsApp do aluno. O link usa token_hash e
 * type=recovery; a página /reset-password troca por sessão e deixa definir a
 * senha nova.
 *
 * Body: { studentId: string }
 */

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://gymfitnesscampos.com.br/app").replace(/\/$/, "");

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SRK) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });
  }

  const jwt = tokenFromRequest(request);
  if (!jwt) {
    return NextResponse.json({ ok: false, error: "Sessão necessária." }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  }

  let body: { studentId?: string } = {};
  try {
    body = (await request.json()) as { studentId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Envio inválido." }, { status: 400 });
  }
  const studentId = body.studentId ?? "";
  if (!studentId) {
    return NextResponse.json({ ok: false, error: "Aluno não informado." }, { status: 400 });
  }

  const { data: me } = await admin
    .from("profiles")
    .select("id, role, gym_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const staff = me as { id: string; role: string; gym_id: string } | null;
  if (!staff || !["manager", "trainer", "admin"].includes(staff.role)) {
    return NextResponse.json({ ok: false, error: "Somente a equipe pode gerar o link." }, { status: 403 });
  }

  const { data: student } = await admin
    .from("profiles")
    .select("id, name, email, gym_id, role")
    .eq("id", studentId)
    .maybeSingle();
  const stu = student as { id: string; name: string; email: string | null; gym_id: string; role: string } | null;
  if (!stu || stu.gym_id !== staff.gym_id || stu.role !== "student") {
    return NextResponse.json({ ok: false, error: "Aluno não encontrado nesta academia." }, { status: 404 });
  }
  if (!stu.email) {
    return NextResponse.json({ ok: false, error: "Aluno sem e-mail cadastrado." }, { status: 400 });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: stu.email,
  });
  if (linkErr || !link) {
    return NextResponse.json(
      { ok: false, error: linkErr?.message ?? "Não deu para gerar o link." },
      { status: 500 }
    );
  }

  const tokenHash =
    (link as { properties?: { hashed_token?: string }; hashed_token?: string }).properties?.hashed_token ??
    (link as { hashed_token?: string }).hashed_token ??
    "";
  if (!tokenHash) {
    return NextResponse.json({ ok: false, error: "Link sem token." }, { status: 500 });
  }

  const url = `${APP_URL}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  return NextResponse.json({ ok: true, link: url, email: stu.email, name: stu.name });
}
