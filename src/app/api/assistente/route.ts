import { handleAssistente } from "~/lib/ai/assistente-core";
import { validateSession } from "~/lib/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Rota unificada de inteligência do app (ver lib/ai/assistente-core.ts). */
export async function POST(request: Request) {
  // P0.2: Autenticação obrigatória — impede uso anônimo
  try {
    await validateSession(request);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }
  return handleAssistente(request);
}
