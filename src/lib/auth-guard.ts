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
 * Extrai o JWT do cookie de sessão do @supabase/ssr.
 * Formatos suportados:
 *  - sb-<ref>-auth-token = base64-<b64(JSON session)> (formato atual)
 *  - sb-<ref>-auth-token = <b64(JSON session)> (legado)
 *  - sb-<ref>-auth-token = <JWT cru> (fallback)
 *  - chunks: sb-<ref>-auth-token.0 / .1 quando a sessão excede o limite do cookie
 */
function tokenFromCookie(cookieHeader: string): string {
  // junta chunks (sb-<ref>-auth-token.0, .1 ...) se existirem
  const chunkRe = /sb-[\w-]*auth-token\.(\d+)=([^;]+)/g;
  const chunks: Array<{ i: number; v: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = chunkRe.exec(cookieHeader))) chunks.push({ i: Number(m[1]), v: m[2] });
  let raw = "";
  if (chunks.length) {
    raw = chunks.sort((a, b) => a.i - b.i).map((c) => c.v).join("");
  } else {
    const single = cookieHeader.match(/sb-[\w-]*auth-token=([^;]+)/);
    if (single) raw = single[1];
  }
  if (!raw) return "";

  // formato atual: prefixo base64- + JSON da sessão
  const candidate = raw.startsWith("base64-") ? raw.slice(7) : raw;
  try {
    const decoded = JSON.parse(Buffer.from(candidate, "base64").toString());
    if (decoded?.access_token) return decoded.access_token;
  } catch {
    // não era base64 de JSON
  }
  // tentativa: JSON direto (sem base64)
  try {
    const decoded = JSON.parse(decodeURIComponent(raw));
    if (decoded?.access_token) return decoded.access_token;
  } catch {
    // não era JSON
  }
  // era o JWT cru
  return raw;
}

/**
 * Valida sessão a partir de cookies do request (Server Components / Route Handlers).
 * Tenta extrair o JWT do header Authorization ou do cookie sb-*-auth-token (SSR).
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization") ?? "";
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Se não tem Authorization header, tenta cookie
  if (!token) {
    const cookieHeader = request.headers.get("Cookie") ?? "";
    token = tokenFromCookie(cookieHeader);
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
  let token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const cookieHeader = request.headers.get("Cookie") ?? "";
    token = tokenFromCookie(cookieHeader);
  }

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
