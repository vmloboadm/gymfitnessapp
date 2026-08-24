/**
 * OmniRoute, gateway próprio de IA (REGRA 0.2 do projeto).
 *
 * TODA integração de IA passa por este arquivo. Nunca chamar
 * providers externos (OpenAI, Anthropic, Mistral...) direto no app.
 *
 * Este é o stub Fase 1: sem credencial configurada, devolve erro claro.
 * Fase 2 preenche a chamada real ao gateway (OMNIRoute_API_KEY).
 */

export type AiPurpose =
  | "generate_workout"
  | "parse_ficha"
  | "edit_template"
  | "plato_detection"
  | "insight_student"
  | "insight_trainer"
  | "insight_manager"
  | "register_student";

export type AiRequest = {
  purpose: AiPurpose;
  system?: string;
  prompt: string;
  sensitiveData?: boolean;
};

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

const AI_ENDPOINT =
  process.env.OMNIRoute_API_KEY
    ? process.env.NEXT_PUBLIC_OMNIRoute_ENDPOINT ?? "https://omniroute.com/generate"
    : null;

/**
 * Chama o gateway OmniRoute. Lança/retorna erro se não configurado -
 * nunca cai em provider externo.
 */
export async function generate(payload: AiRequest): Promise<AiResult> {
  if (!AI_ENDPOINT) {
    return {
      ok: false,
      error: "OMNIRoute_API_KEY não configurada, IA indisponível nesta fase.",
    };
  }

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OMNIRoute_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { text?: string; model?: string };
    if (!res.ok) {
      return { ok: false, error: `OmniRoute ${res.status}: ${res.statusText}` };
    }
    return {
      ok: true,
      text: json.text ?? "",
      model: json.model ?? "omniroute",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro de rede OmniRoute" };
  }
}

/** Retorna true se o gateway está configurado (para a UI decidir). */
export function isAiConfigured(): boolean {
  return !!AI_ENDPOINT;
}
