/**
 * Adaptador server-only de envio automático de WhatsApp.
 * NUNCA importar de componente cliente: usa envs privadas e fetch de servidor.
 * Providers: none (padrão, skip), evolution (self-hosted) e meta (Cloud API).
 */

import { logger } from "~/lib/logger";

export type WhatsAppSendResult = { ok: boolean; skipped?: boolean; error?: string };

/** Remove quebras de linha e espaçamento irregular de textos de mensagem. */
function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa aspas duplas em campos interpolados (mensagem de texto simples). */
function escapeField(value: string): string {
  return sanitizeText(value).replace(/"/g, "'");
}

/** Mensagem curta e motivadora para treino registrado pelo aluno. */
export function workoutDoneMessage(
  nomeAluno: string,
  nomeTreino: string,
  detalhe?: string
): string {
  const nome = escapeField(nomeAluno) || "Atleta";
  const treino = escapeField(nomeTreino) || "o treino de hoje";
  const extra = detalhe ? sanitizeText(detalhe) : "";
  const base = `Olá ${nome}! Treino "${treino}" registrado com sucesso.`;
  return sanitizeText(extra ? `${base} ${extra} Continue assim!` : `${base} Continue assim!`);
}

/** Envia um texto puro via provider configurado. Sem provider → skipped. */
export async function sendWhatsAppText(
  phoneE164: string,
  text: string
): Promise<WhatsAppSendResult> {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase().trim();
  if (!provider || provider === "none") {
    return { ok: false, skipped: true };
  }

  if (provider === "evolution") {
    const apiUrl = process.env.EVO_API_URL;
    const apiKey = process.env.EVO_API_KEY;
    const instance = process.env.EVO_INSTANCE;
    if (!apiUrl || !apiKey || !instance) {
      return {
        ok: false,
        error: "Evolution API incompleta (EVO_API_URL, EVO_API_KEY, EVO_INSTANCE).",
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(
        `${apiUrl.replace(/\/$/, "")}/message/sendText/${instance}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: phoneE164, text }),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        logger.warn("whatsapp.evolution_http", { status: res.status });
        return { ok: false, error: `Evolution respondeu ${res.status}.` };
      }
      return { ok: true };
    } catch (err) {
      logger.error("whatsapp.evolution_error", err);
      return { ok: false, error: "Falha ao enviar pelo Evolution." };
    } finally {
      clearTimeout(timer);
    }
  }

  if (provider === "meta") {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return {
        ok: false,
        error: "Meta WhatsApp incompleta (META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID).",
      };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneE164,
          type: "text",
          text: { body: text },
        }),
      });
      if (!res.ok) {
        logger.warn("whatsapp.meta_http", { status: res.status });
        return { ok: false, error: `Meta respondeu ${res.status}.` };
      }
      return { ok: true };
    } catch (err) {
      logger.error("whatsapp.meta_error", err);
      return { ok: false, error: "Falha ao enviar pela Meta." };
    }
  }

  return { ok: false, error: `Provedor WhatsApp desconhecido: ${provider}.` };
}
