import { handleAssistente } from "~/lib/ai/assistente-core";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Rota unificada de inteligência do app (ver lib/ai/assistente-core.ts). */
export async function POST(request: Request) {
  return handleAssistente(request);
}
