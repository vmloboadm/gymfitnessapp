import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * POST /api/avatar — upload de foto de perfil com encaixe facial.
 *
 * Recebe multipart { file } + Authorization (JWT do usuário logado).
 * O smart crop da sharp (strategy: attention) localiza a região de interesse
 * (rosto) e encaixa num quadrado 400x400 webp — o recorte sai centrado no
 * rosto sem o usuário precisar ajustar nada. Sobe no bucket avatars e
 * atualiza profiles.avatar_url (com service role, apenas do próprio usuário
 * do token).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AVATAR_BUCKET = "avatars";

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SRK) {
    return NextResponse.json(
      { ok: false, error: "Storage não configurado." },
      { status: 500 }
    );
  }

  // 1) valida o usuário pelo JWT dele (ninguém troca foto de outro)
  const authHeader = request.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return NextResponse.json({ ok: false, error: "Sessão necessária." }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  }
  const userId = userData.user.id;

  // 2) recebe a imagem
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Envio inválido." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Foto não recebida." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "Foto grande demais. Envie até 8 MB." },
      { status: 400 }
    );
  }

  // 3) smart crop focado no rosto: attention encontra a região saliente
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    const cropped = await sharp(buffer)
      .rotate() // respeita EXIF (foto de celular)
      .resize(400, 400, {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .webp({ quality: 82 })
      .toBuffer();
    buffer = cropped;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não consegui ler essa imagem. Envie um JPG ou PNG." },
      { status: 400 }
    );
  }

  // 4) sobe no bucket e devolve a URL pública
  const path = `${userId}/${Date.now()}.webp`;
  const { error: upErr } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType: "image/webp",
      upsert: true,
    });
  if (upErr) {
    return NextResponse.json(
      { ok: false, error: "Falha ao salvar a foto. Tente novamente." },
      { status: 500 }
    );
  }
  const pubRaw = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path) as unknown as {
    data?: { publicUrl?: string };
    publicUrl?: string;
  };
  const publicUrl = pubRaw.data?.publicUrl ?? pubRaw.publicUrl ?? null;

  // 5) atualiza o perfil do próprio usuário
  const { error: profErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profErr) {
    // foto salva no storage; o perfil é atualizado pelo cliente como fallback
    return NextResponse.json({
      ok: true,
      url: publicUrl,
      warning: "Foto salva, mas o perfil precisa ser atualizado pelo app.",
    });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
