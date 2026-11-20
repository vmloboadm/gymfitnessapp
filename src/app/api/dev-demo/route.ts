import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acesso demo do dono. Desligado enquanto DEV_DEMO_SENHA_HASH não estiver
 * configurado na Vercel (responde 404). Senha em hash scrypt: "scrypt:<salt>:<hash>".
 * Contas e senhas das contas demo ficam em variáveis de ambiente, nunca no código.
 */

const ROLE_ENV: Record<string, string> = { aluno: "ALUNO", personal: "PERSONAL", gestor: "GESTOR" };

const tentativas = new Map<string, { n: number; t: number }>();
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;

function verificarSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = guardado.split(":");
  if (alg !== "scrypt" || !saltHex || !hashHex) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(senha, Buffer.from(saltHex, "hex"), 32, (err, key) => {
      if (err) return resolve(false);
      const esperado = Buffer.from(hashHex, "hex");
      resolve(esperado.length === key.length && timingSafeEqual(key, esperado));
    });
  });
}

function limitado(ip: string): boolean {
  const agora = Date.now();
  const r = tentativas.get(ip);
  if (!r || agora - r.t > JANELA_MS) {
    tentativas.set(ip, { n: 1, t: agora });
    return false;
  }
  r.n += 1;
  return r.n > MAX_TENTATIVAS;
}

export async function POST(req: Request) {
  const guardado = process.env.DEV_DEMO_SENHA_HASH;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!guardado || !supaUrl || !anon) return new NextResponse(null, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (limitado(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { senha?: unknown; papel?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const senha = typeof body.senha === "string" ? body.senha : "";
  const papel = typeof body.papel === "string" ? body.papel : "";
  const sufixo = ROLE_ENV[papel];
  if (!senha || !sufixo) return NextResponse.json({ ok: false }, { status: 400 });

  const ok = await verificarSenha(senha, guardado);
  // pequeno atraso uniforme para não dar pista de tempo
  await new Promise((r) => setTimeout(r, 400 + randomBytes(1)[0]! % 200));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const email = process.env[`DEV_DEMO_${sufixo}_EMAIL`];
  const pass = process.env[`DEV_DEMO_${sufixo}_SENHA`];
  if (!email || !pass) return NextResponse.json({ ok: false }, { status: 404 });

  const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 502 });
  const sessao = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!sessao.access_token || !sessao.refresh_token) return NextResponse.json({ ok: false }, { status: 502 });

  return NextResponse.json({ ok: true, access_token: sessao.access_token, refresh_token: sessao.refresh_token });
}
