"use client";

/** Barramento do Personal Digital: dispara abertura com contexto pré-preenchido.
 *  Arquivo minúsculo de propósito — quem importa isso NÃO puxa o chat no bundle. */
export function openAiCoach(query: string) {
  document.dispatchEvent(new CustomEvent("gf-ask-ai", { detail: { query } }));
}
