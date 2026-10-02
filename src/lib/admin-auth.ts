import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Auth do painel interno (/admin): senha única na env ADMIN_PANEL_KEY.
 * O cookie guarda o SHA-256 do token (nunca a senha), comparado em tempo
 * constante. SERVER-ONLY: nunca importar em componente client.
 */
const COOKIE = "gf_admin";
const SALT = "gf_admin_v1:";

export const ADMIN_COOKIE = COOKIE;

/** Token esperado no cookie, ou null se a env não estiver configurada. */
export function adminToken(): string | null {
  const key = process.env.ADMIN_PANEL_KEY;
  if (!key) return null;
  return createHash("sha256").update(SALT + key).digest("hex");
}

/** Cookie presente e válido? */
export function validAdminCookie(value?: string): boolean {
  const expected = adminToken();
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Senha enviada no form bate com a env? (em tempo constante) */
export function checkPassword(sent: FormDataEntryValue | null): boolean {
  const key = process.env.ADMIN_PANEL_KEY;
  if (!key || typeof sent !== "string") return false;
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(key).digest();
  return timingSafeEqual(a, b);
}

export const ADMIN_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dias
};
