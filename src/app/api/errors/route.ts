import { NextResponse } from "next/server";
import { authenticateRequest } from "~/lib/api-auth";
import { normalizeEvent, type ErrorEvent } from "~/lib/monitoring/shared";
import { storeErrors } from "~/lib/monitoring/server";

export const runtime = "nodejs";

/**
 * POST /api/errors — recebe erros do app (lote de até 10) e grava em
 * app_errors. Aberta também para quem não logou (tela de login quebra
 * também); o usuário só é anexado se o Bearer token for válido.
 * Limite simples por IP para ninguém encher a tabela.
 */

const MAX_EVENTS = 10;
const MAX_BODY = 32_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { start: number; count: number }>();

function rateLimited(ip: string, n: number): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: n });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.count += n;
  return h.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: { events?: unknown; build?: unknown; token?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_EVENTS)
    .map(normalizeEvent)
    .filter((e): e is ErrorEvent => e !== null);
  if (!events.length) return NextResponse.json({ ok: true, stored: 0 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
  if (rateLimited(ip, events.length)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // sendBeacon não manda header: o token pode vir no corpo
  let userId: string | null = null;
  const token = typeof body.token === "string" ? body.token : null;
  const auth = request.headers.get("authorization") ? request : token
    ? new Request(request.url, { headers: { authorization: `Bearer ${token}` } })
    : null;
  if (auth) {
    const res = await authenticateRequest(auth).catch(() => null);
    if (res?.ok) userId = res.user.id;
  }

  await storeErrors(events, {
    source: "client",
    userId,
    userAgent: request.headers.get("user-agent"),
    build: typeof body.build === "string" ? body.build : null,
  });

  return NextResponse.json({ ok: true, stored: events.length });
}
