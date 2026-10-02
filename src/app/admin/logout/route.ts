import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "~/lib/admin-auth";

/** POST /admin/logout — limpa o cookie do painel. */
export async function POST(request: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const res = NextResponse.redirect(new URL(`${base}/admin`, request.url), 303);
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
