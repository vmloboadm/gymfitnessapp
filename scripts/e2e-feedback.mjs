/**
 * E2E do fluxo Finalizar + Feedback + Diário + Relatório:
 *   1. cria sessão ativa abandonada (13h atrás) via service role
 *   2. aluno abre /treino → sheet "Como foi o treino de ontem?" aparece
 *   3. responde sensação + duração + exemplo → salva no meta
 *   4. /progresso mostra no Diário
 *   5. pede relatório de evolução → premium_requests criado
 *   6. limpeza
 */
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = process.env.SMOKE_URL ?? "https://gymfitnessapp-delta.vercel.app";
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const STUDENT = { email: "teste@gymfitness.com", password: "teste1234" };
const ALUNO_ID = "e0782c90-4322-4b00-a7f6-f7b22cc425ef";
const GYM_ID = "00000000-0000-0000-0000-000000000001";
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);

const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };

async function main() {
  // SETUP: sessão abandonada há 13h
  const staleStart = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
  const ins = await fetch(`${SUPA}/rest/v1/workout_sessions`, {
    method: "POST", headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({ gym_id: GYM_ID, student_id: ALUNO_ID, status: "active", started_at: staleStart, meta: {} }),
  });
  const sess = (await ins.json().catch(() => []))[0];
  step("0. setup: sessão abandonada criada", !!sess?.id, sess?.id?.slice(0, 8) ?? "falhou");
  if (!sess?.id) process.exit(1);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 120)));

  try {
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");
    await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.type("#email", STUDENT.email, { delay: 8 });
    await page.type('input[type="password"]', STUDENT.password, { delay: 8 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
    await sleep(2000);
    step("1. login do aluno", true);

    await page.goto(`${BASE}/app/treino`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(5000);

    const sheetShown = await page.evaluate(() => document.body.innerText.includes("Como foi o treino"));
    step("2. sheet de feedback do treino anterior aparece", sheetShown);

    // responde: sensação + duração + exemplo
    const answered = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const feel = btns.find((b) => b.textContent.trim() === "Puxado");
      if (feel) feel.click();
      return !!feel;
    });
    await sleep(500);
    const dur = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const d = btns.find((b) => /^45 min$/.test(b.textContent.trim()));
      if (d) d.click();
      return !!d;
    });
    await sleep(400);
    const ex = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const e = btns.find((b) => b.textContent.includes("Treino puxado hoje!"));
      if (e) e.click();
      return !!e;
    });
    step("3. sensação + duração + exemplo selecionados", answered && dur && ex);
    const saved = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Salvar feedback"));
      if (!b || b.disabled) return "bloqueado";
      b.click();
      return "enviado";
    });
    await sleep(3000);
    step("4. feedback enviado", saved === "enviado", saved);

    // confere no banco
    const chk = await fetch(`${SUPA}/rest/v1/workout_sessions?select=meta,status&id=eq.${sess.id}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
    const row = (await chk.json())[0];
    const meta = row?.meta ?? {};
    step("5. sessão auto-finalizada + feedback salvo no banco", row?.status === "completed" && !!meta.feedback_at && meta.feeling === "puxado" && (meta.note ?? "").includes("Treino puxado"), JSON.stringify({ st: row?.status, f: meta.feeling, min: meta.duration_min }));

    // diário no progresso
    await page.goto(`${BASE}/app/progresso`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(5000);
    const diary = await page.evaluate(() => {
      const t = document.body.innerText;
      return (t.includes("Diário de treinos") || t.includes("DIÁRIO DE TREINOS")) && t.includes("Treino puxado hoje!");
    });
    step("6. diário mostra o feedback no progresso", diary);

    // pede relatório
    const reqBtn = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Pedir relatório detalhado"));
      if (!b || b.disabled) return "indisponivel";
      b.click();
      return "clicado";
    });
    await sleep(3000);
    const reqs = await fetch(`${SUPA}/rest/v1/premium_requests?select=id,details&student_id=eq.${ALUNO_ID}&order=created_at.desc&limit=1`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
    const req = (await reqs.json())[0];
    step("7. pedido de relatório criado", reqBtn === "clicado" && (req?.details ?? "").startsWith("[relatorio]"), (req?.details ?? "").slice(0, 50));

    step("8. zero erros de JS", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));

    // limpeza
    await fetch(`${SUPA}/rest/v1/workout_sessions?id=eq.${sess.id}`, { method: "DELETE", headers: H }).catch(() => {});
    if (req?.id) await fetch(`${SUPA}/rest/v1/premium_requests?id=eq.${req.id}`, { method: "DELETE", headers: H }).catch(() => {});
  } catch (e) {
    step("EXCEÇÃO", false, String(e).slice(0, 250));
  }

  await browser.close();
  const ok = results.every(Boolean);
  console.log(`\n=== FEEDBACK: ${results.filter(Boolean).length}/${results.length} PASS ===`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
