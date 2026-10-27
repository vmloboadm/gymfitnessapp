import { supabaseBrowser } from "~/lib/supabase/client";

const BUCKET = "medical";

/**
 * O bucket "medical" é privado: o laudo só abre com link assinado.
 * Aceita o caminho gravado hoje ("clearances/<id>/<arquivo>") e também as
 * linhas antigas, que guardavam a URL pública (que nunca funcionou).
 */
export function medicalPathFromStored(stored: string): string {
  const marker = `/object/public/${BUCKET}/`;
  const i = stored.indexOf(marker);
  if (i >= 0) return decodeURIComponent(stored.slice(i + marker.length).split("?")[0]);
  return stored;
}

/** Abre o laudo numa aba nova com link válido por 5 minutos. */
export async function openMedicalDoc(stored: string): Promise<void> {
  // abre a aba antes do await para o navegador não bloquear como pop-up
  const tab = window.open("", "_blank");
  const { data, error } = await supabaseBrowser()
    .storage.from(BUCKET)
    .createSignedUrl(medicalPathFromStored(stored), 300);
  if (error || !data?.signedUrl) {
    tab?.close();
    throw new Error("Não foi possível abrir o laudo.");
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = data.signedUrl;
  } else {
    window.location.href = data.signedUrl;
  }
}
