import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encerra a demo: apaga a conta descartável. Só apaga conta marcada como demo. */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return new NextResponse(null, { status: 404 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const eu = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!eu.ok) return NextResponse.json({ ok: false }, { status: 401 });
  const { id, email } = (await eu.json()) as { id?: string; email?: string };
  if (!id || !email?.endsWith("@demo.invalid")) return NextResponse.json({ ok: false }, { status: 403 });

  const admin = { apikey: service, Authorization: `Bearer ${service}` };
  const perfil = await fetch(`${url}/rest/v1/profiles?id=eq.${id}&select=is_demo`, { headers: admin });
  const linhas = (await perfil.json()) as Array<{ is_demo: boolean }>;
  if (linhas[0]?.is_demo !== true) return NextResponse.json({ ok: false }, { status: 403 });

  const apagada = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
  return NextResponse.json({ ok: apagada.ok }, { status: apagada.ok ? 200 : 502 });
}
