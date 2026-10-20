import { createClient } from "@supabase/supabase-js";

export type ApiUser = { id: string };

/**
 * Autentica o request pelo header Authorization: Bearer <access_token>.
 * Padrão das rotas da API (mesmo do /api/sync): valida o JWT com anon key.
 */
export async function authenticateRequest(request: Request): Promise<
  { ok: true; user: ApiUser } | { ok: false; status: number; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, status: 503, error: "Supabase não configurado." };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: "Não autenticado." };
  }

  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
  }
  return { ok: true, user: { id: data.user.id } };
}
