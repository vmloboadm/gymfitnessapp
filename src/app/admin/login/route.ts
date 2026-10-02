import { NextResponse } from "next/server";
import { checkPassword, adminToken, ADMIN_COOKIE, ADMIN_COOKIE_OPTS } from "~/lib/admin-auth";

/** POST /admin/login — valida a senha da env e seta o cookie do painel. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const ok = checkPassword(form?.get("password") ?? null);
  const token = adminToken();

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const back = new URL(`${base}/admin${ok ? "" : "?erro=1"}`, request.url);

  if (!ok || !token) {
    // sem ADMIN_PANEL_KEY configurada também cai aqui
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(`${base}/admin`, request.url), 303);
  res.cookies.set(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTS);
  return res;
}
