/**
 * WhatsApp oficial da academia — número único vinculado ao app.
 * Fase 1 (atual): links manuais centralizados (suporte, parcerias).
 * Fase 2 (futura): Cloud API + fila de envios (ver docs/ROADMAP-WHATSAPP.md).
 * Fase 3 (futura): CRM.
 */

/** Número oficial com DDI+DDD, só dígitos. */
export const GYM_WHATSAPP = process.env.NEXT_PUBLIC_GYM_WHATSAPP ?? "";

/** Monta link wa.me com mensagem pré-preenchida. */
export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Link de suporte: falar com a academia. */
export function gymSupportLink(context?: string): string {
  if (!GYM_WHATSAPP) return "";
  const msg = context
    ? `Olá! Sou aluno GymFitness e preciso de ajuda (${context}).`
    : "Olá! Sou aluno GymFitness e preciso de ajuda.";
  return waLink(GYM_WHATSAPP, msg);
}

/** Link de parcerias (usa o número oficial se o específico não existir). */
export function partnerLink(): string {
  const specific = process.env.NEXT_PUBLIC_PARTNER_WHATSAPP ?? "";
  const phone = specific || GYM_WHATSAPP;
  if (!phone) return "mailto:contato@gymfitnesscampos.com.br?subject=" + encodeURIComponent("Quero ser parceiro · GymFitness");
  return waLink(phone, "Olá! Vim pelo QR code da academia e quero saber mais sobre as parcerias do GymFitness.");
}
