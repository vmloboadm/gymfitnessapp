import { handleAssistente } from "~/lib/ai/assistente-core";
import { validateSession } from "~/lib/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/coach (legado): delega para a mesma lógica de /api/assistente
 * com contexto "aluno". Mantido por compatibilidade de URL.
 */
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
