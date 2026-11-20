import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acesso demo do dono. Desligado enquanto DEV_DEMO_SENHA_HASH não estiver
 * configurado (responde 404). Cada acesso cria uma conta descartável (is_demo):
 * fica invisível para a academia e é apagada ao encerrar, ou sozinha em 3 horas.
 */

const TIPO_PAPEL: Record<string, { perfil: "student" | "trainer" | "manager"; nome: string }> = {
  aluno: { perfil: "student", nome: "Aluno Demo" },
  personal: { perfil: "trainer", nome: "Personal Demo" },
  gestor: { perfil: "manager", nome: "Gestor Demo" },
};

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

/** Cria a conta descartável e devolve a sessão. null se algo falhar (a conta é apagada). */
async function criarContaDemo(url: string, anon: string, service: string, papel: string) {
  const cfg = TIPO_PAPEL[papel];
  if (!cfg) return null;
  const email = `demo-${randomBytes(6).toString("hex")}@demo.invalid`;
  const senha = randomBytes(24).toString("base64url");
  const admin = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

  const criada = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { name: cfg.nome } }),
  });
  if (!criada.ok) return null;
  const uid = ((await criada.json()) as { id?: string }).id;
  if (!uid) return null;

  const perfil = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH",
    headers: { ...admin, Prefer: "return=minimal" },
    body: JSON.stringify({
      is_demo: true,
      role: cfg.perfil,
      status: "active",
      ...(cfg.perfil === "student" ? {} : { approved_at: new Date().toISOString() }),
    }),
  });
  if (!perfil.ok) {
    await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: admin });
    return null;
  }

  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!login.ok) return null;
  const sessao = (await login.json()) as { access_token?: string; refresh_token?: string };
  if (!sessao.access_token || !sessao.refresh_token) return null;
  return { access_token: sessao.access_token, refresh_token: sessao.refresh_token };
}

export async function POST(req: Request) {
  const guardado = process.env.DEV_DEMO_SENHA_HASH;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!guardado || !url || !anon || !service) return new NextResponse(null, { status: 404 });

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
  if (!senha || !TIPO_PAPEL[papel]) return NextResponse.json({ ok: false }, { status: 400 });

  const ok = await verificarSenha(senha, guardado);
  await new Promise((r) => setTimeout(r, 400 + (randomBytes(1)[0] ?? 0) % 200));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const sessao = await criarContaDemo(url, anon, service, papel);
  if (!sessao) return NextResponse.json({ ok: false }, { status: 502 });
  return NextResponse.json({ ok: true, ...sessao });
}
