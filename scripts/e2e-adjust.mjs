/**
 * E2E do Ajuste com IA (v2):
 *   personal abre plano atribuído → Ajustar com IA → descreve mudança →
 *   gera v2 → aprova → novo programa criado + antigo concluído.
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
const TRAINER = { email: "gestor@gymfitness.com", password: "teste1234" };
const ALUNO_ID = "e0782c90-4322-4b00-a7f6-f7b22cc425ef";
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);

const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dbJwt() {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TRAINER.email, password: TRAINER.password }),
  });
  return (await r.json()).access_token;
}

async function main() {
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
    await page.type("#email", TRAINER.email, { delay: 8 });
    await page.type('input[type="password"]', TRAINER.password, { delay: 8 });
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
    await sleep(2000);
    step("1. login", true);

    // pega um plano ativo do aluno no banco
    const jwt = await dbJwt();
    const H = { apikey: ANON, Authorization: `Bearer ${jwt}` };
    const sws = await (await fetch(`${SUPA}/rest/v1/student_workouts?select=id&student_id=eq.${ALUNO_ID}&status=eq.active&order=assigned_at.desc&limit=1`, { headers: H })).json();
    const swId = sws[0]?.id;
    step("2. plano ativo encontrado no banco", !!swId, (swId ?? "").slice(0, 8));
    if (!swId) { await browser.close(); process.exit(1); }

    await page.goto(`${BASE}/app/personal/treinos?aluno=${ALUNO_ID}&adjust=${swId}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(6000);

    const banner = await page.evaluate(() => document.body.innerText.includes("Ajustando") && document.body.innerText.includes("Gerar ajuste"));
    step("3. modo ajuste com banner + botão v2", banner);

    // o plano atual carregou?
    const hasPlan = await page.evaluate(() => document.body.innerText.includes("Aprovar e Atribuir"));
    step("4. plano atual carregado para revisão", hasPlan);

    // descreve o ajuste e gera (aguarda prefill do assistente liberar o botão)
    const ta = await page.$('textarea[aria-label="Observações do personal"]');
    if (ta) await ta.type("Trocar o primeiro exercício por uma variação com halteres", { delay: 5 });
    let gen = false;
    for (let i = 0; i < 10 && !gen; i++) {
      await sleep(800);
      gen = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Gerar ajuste"));
        if (!b || b.disabled) return false;
        b.click();
        return true;
      });
    }
    step("5. ajuste descrito e geração iniciada", gen);

    try {
      // primeiro confirma que a (re)geração começou…
      await page.waitForFunction(() => document.body.innerText.includes("Periodizando"), { timeout: 20000 });
      // …depois que a v2 chegou
      await page.waitForFunction(() => {
        const t = document.body.innerText;
        return t.includes("Aprovar e Atribuir") && !t.includes("Periodizando");
      }, { timeout: 150000 });
      step("6. v2 gerada", true);
    } catch {
      step("6. v2 gerada", false, "timeout");
    }

    const before = await (await fetch(`${SUPA}/rest/v1/student_workouts?select=id,status&student_id=eq.${ALUNO_ID}`, { headers: H })).json();
    const approveBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Aprovar e Atribuir")));
    await approveBtn.asElement().click();
    let toastOk = false;
    try {
      await page.waitForFunction(() => document.body.innerText.includes("Plano ajustado com sucesso"), { timeout: 25000 });
      toastOk = true;
    } catch { /* abaixo */ }
    step("7. v2 aprovada (toast)", toastOk);

    await sleep(2000);
    const after = await (await fetch(`${SUPA}/rest/v1/student_workouts?select=id,status&student_id=eq.${ALUNO_ID}`, { headers: H })).json();
    const oldRow = after.find((r) => r.id === swId);
    const newActive = after.filter((r) => r.status === "active" && r.id !== swId);
    step("8. antigo concluído + nova v2 ativa", oldRow?.status === "completed" && newActive.length >= 1, `antigo=${oldRow?.status} novas=${newActive.length} (antes: ${before.length})`);

    step("9. zero erros de JS", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));
  } catch (e) {
    step("EXCEÇÃO", false, String(e).slice(0, 250));
  }

  await browser.close();
  const ok = results.every(Boolean);
  console.log(`\n=== ADJUST: ${results.filter(Boolean).length}/${results.length} PASS ===`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
