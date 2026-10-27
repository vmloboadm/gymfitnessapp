import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tokenFromRequest } from "~/lib/auth-guard";
import sharp from "sharp";

/**
 * POST /api/progress-photo — foto de evolução (antes/depois) do aluno.
 *
 * multipart { file, angle, phase, visibility } + Authorization (JWT).
 * Mesmo smart crop do avatar, mas salva em progress/{userId}/... e grava
 * em progress_photos (visibilidade padrão: só o aluno).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const AVATAR_BUCKET = "avatars";

const ANGLES = ["frente", "lado", "costas"] as const;
const PHASES = ["antes", "depois"] as const;
const VIS = ["self", "trainer"] as const;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SRK) {
    return NextResponse.json({ ok: false, error: "Storage não configurado." }, { status: 500 });
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
  const userId = userData.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Envio inválido." }, { status: 400 });
  }
  const file = form.get("file");
  const angle = String(form.get("angle") ?? "");
  const phase = String(form.get("phase") ?? "");
  const visibility = String(form.get("visibility") ?? "self");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Foto não recebida." }, { status: 400 });
  }
  if (!((ANGLES as readonly string[]).includes(angle)) || !((PHASES as readonly string[]).includes(phase))) {
    return NextResponse.json({ ok: false, error: "Ângulo ou fase inválidos." }, { status: 400 });
  }
  const vis = ((VIS as readonly string[]).includes(visibility) ? visibility : "self") as "self" | "trainer";
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Foto grande demais. Envie até 8 MB." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    const cropped = await sharp(buffer)
      .rotate()
      .resize(800, 1000, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 82 })
      .toBuffer();
    buffer = cropped;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não consegui ler essa imagem. Envie um JPG ou PNG." },
      { status: 400 }
    );
  }

  const path = `progress/${userId}/${Date.now()}.webp`;
  const { error: upErr } = await admin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ ok: false, error: "Falha ao salvar a foto. Tente novamente." }, { status: 500 });
  }
  const pubRaw = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path) as unknown as {
    data?: { publicUrl?: string };
    publicUrl?: string;
  };
  const publicUrl = pubRaw.data?.publicUrl ?? pubRaw.publicUrl ?? null;
  if (!publicUrl) {
    return NextResponse.json({ ok: false, error: "Falha ao salvar a foto. Tente novamente." }, { status: 500 });
  }

  const { data: prof } = await admin.from("profiles").select("gym_id").eq("id", userId).single();
  const gymId = (prof as { gym_id?: string } | null)?.gym_id;
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "Academia não identificada." }, { status: 400 });
  }
  const { error: insErr } = await admin.from("progress_photos").insert({
    gym_id: gymId,
    student_id: userId,
    url: publicUrl,
    angle,
    phase,
    visibility: vis,
  });
  if (insErr) {
    return NextResponse.json({ ok: false, error: "Foto salva, mas não entrou no histórico." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: publicUrl });
}
