import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Envia o laudo médico: arquivo no bucket privado "medical" + registro em
 * medical_clearances (a equipe abre com link assinado, lib/medical-doc).
 * Usado no cadastro (MedicalRestrictionForm) e no aviso dentro do app.
 */
export async function uploadClearance(
  profile: { id: string; gym_id: string | null },
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Envie um PDF ou imagem de até 5 MB." };
  if (!profile.gym_id) return { ok: false, error: "Perfil sem academia." };
  const supabase = supabaseBrowser();
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `clearances/${profile.id}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("medical").upload(path, file, { upsert: false });
  if (error) return { ok: false, error: error.message };
  const { error: insertError } = await supabase.from("medical_clearances").insert({
    gym_id: profile.gym_id,
    student_id: profile.id,
    document_url: path,
  } as never);
  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}
