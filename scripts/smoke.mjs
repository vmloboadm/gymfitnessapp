/**
 * Smoke E2E — fluxo de PRODUÇÃO:
 *   servidor → login real do personal (Supabase Auth) → profile trainer
 *   → telas do staff renderizam → sem erros de JS.
 *
 * Uso:
 *   SMOKE_URL=http://localhost:3002 node scripts/smoke.mjs
 *
 * Requisito: NEXT_PUBLIC_DEMO_MODE=0 no servidor alvo e profiles reais.
 * Sai com código 0 em sucesso, 1 em qualquer falha.
 */
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";

// .env.local do projeto (um script node puro não carrega Next env)
const env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch { /* segue com process.env */ }

const URL_BASE = process.env.SMOKE_URL ?? "http://localhost:3002";
const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE,
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome",
].filter(Boolean);

const findChrome = () => CHROME_CANDIDATES.find((p) => existsSync(p));

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const EMAIL = process.env.SMOKE_EMAIL ?? "gffitness2024@gmail.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "academiagf2026";

async function main() {
  const steps = [];
  const step = (name, ok, detail = "") => {
    steps.push({ ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  };

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));

  try {
    // 1. servidor no ar
    const res = await fetch(`${URL_BASE}/login`);
    step("produção: servidor responde", res.ok, `HTTP ${res.status}`);

    // 2. login real do personal (Supabase Auth)
    let jwt = "";
    try {
      const loginRes = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      const data = await loginRes.json();
      jwt = data.access_token ?? "";
    } catch {
      /* tratado abaixo */
    }
    step("produção: login do personal", !!jwt);

    // 3. profile trainer legível (RLS)
    let role = "";
    if (jwt) {
      const profRes = await fetch(`${SUPA}/rest/v1/profiles?select=name,role`, {
        headers: { apikey: ANON, Authorization: `Bearer ${jwt}` },
      });
      role = (await profRes.json())?.[0]?.role ?? "";
    }
    step("produção: profile trainer legível", role === "trainer", `role=${role}`);

    // 4. login pelo formulário do app (fluxo real)
    await page.goto(`${URL_BASE}/login`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r2) => setTimeout(r2, 1800));
    await page.type("#email", EMAIL);
    await page.type("#password", PASSWORD);
    await page.evaluate(() => {
      const f = document.querySelector("form");
      if (f) f.requestSubmit();
    });
    await new Promise((r2) => setTimeout(r2, 6000));
    step("produção: formulário autentica", page.url().includes("/personal/"), page.url());

    // 5-6. telas do staff renderizam logado
    for (const r of ["/personal/dashboard", "/personal/alunos", "/personal/exercicios"]) {
      await page.goto(`${URL_BASE}${r}`, { waitUntil: "networkidle2", timeout: 45000 });
      // espera o conteúdo crescer (queries com RLS no primeiro load)
      let text = 0;
      for (let i = 0; i < 12; i++) {
        await new Promise((r2) => setTimeout(r2, 800));
        text = await page.evaluate(() => document.body.innerText.length);
        if (text > 100) break;
      }
      step(`staff ${r} renderiza`, text > 100, `${text} chars`);
    }

    // 7. sem erros JS não tratados
    await page.goto(`${URL_BASE}/feed`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    step("sem erros JS não tratados", jsErrors.length === 0);
  } catch (err) {
    step("fluxo executou até o fim", false, err.message);
  } finally {
    await browser.close();
  }

  const passed = steps.filter((s) => s.ok).length;
  console.log(`\n${passed}/${steps.length} etapas OK`);
  process.exitCode = passed === steps.length ? 0 : 1;
}

main().catch((e) => {
  console.error("smoke falhou:", e);
  process.exit(1);
});
