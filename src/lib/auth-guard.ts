/**
 * Auth guard para rotas de API.
 * Valida JWT via Authorization header ou cookies (SSR).
 * Retorna o usuário autenticado ou lança 401.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AuthUser = {
  id: string;
  email?: string;
};

type AuthResult = {
  user: AuthUser;
  supabase: SupabaseClient;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Valida sessão a partir de cookies do request (Server Components / Route Handlers).
 * Tenta extrair o JWT do header Authorization ou do cookie supabase-auth-token.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization") ?? "";
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Se não tem Authorization header, tenta cookie
  if (!token) {
    const cookieHeader = request.headers.get("Cookie") ?? "";
    const match = cookieHeader.match(/supabase-auth-token=([^;]+)/);
    if (match) {
      // cookie pode ser base64 encoded
      try {
        const decoded = JSON.parse(Buffer.from(match[1], "base64").toString());
        token = decoded?.access_token ?? "";
      } catch {
        token = match[1];
      }
    }
  }

  if (!token) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Sessão necessária." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validar JWT usando o client admin (bypassa RLS para leitura do user)
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const admin = createClient(SUPABASE_URL, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !userData?.user) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Sessão inválida." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Client com o JWT do usuário (RLS se aplica)
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return {
    user: { id: userData.user.id, email: userData.user.email },
    supabase,
  };
}

/**
 * Versão leve: só valida se tem sessão, sem criar client RLS.
 * Útil para endpoints que só precisam saber "está logado?".
 */
export async function validateSession(request: Request): Promise<AuthUser> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Sessão necessária." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const admin = createClient(SUPABASE_URL, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !userData?.user) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Sessão inválida." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { id: userData.user.id, email: userData.user.email };
}
