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
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);
const ALUNO_ID = "e0782c90-4322-4b00-a7f6-f7b22cc425ef";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 120)));

try {
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.type("#email", "gestor@gymfitness.com", { delay: 10 });
  await page.type('input[type="password"]', "teste1234", { delay: 10 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
  await sleep(2000);
  step("1. login", true);

  await page.goto(`${BASE}/app/personal/treinos`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(3000);

  // seção "Planos-modelo" presente?
  const hasTpl = await page.evaluate(() => document.body.innerText.includes("Planos-modelo"));
  step("2. seção Planos-modelo visível", hasTpl);

  // aplica o template "Glúteos Foco" em massa pro Aluno Teste
  const clickedCard = await page.evaluate(() => {
    const articles = [...document.querySelectorAll("article")];
    const card = articles.find((a) => a.textContent.includes("Glúteos Foco"));
    if (!card) return false;
    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Aplicar em Massa"));
    if (!btn) return false;
    btn.click();
    return true;
  });
  step("2b. botão Aplicar em Massa do template", clickedCard);
  await sleep(1500);

  // sheet aberto: seleciona o Aluno Teste
  const sel = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("li button")];
    const row = rows.find((b) => b.textContent.includes("Aluno Teste"));
    if (!row) return false;
    row.click();
    return true;
  });
  step("2c. aluno selecionado no sheet", sel);
  await sleep(400);
  const goBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Aplicar para 1 aluno")));
  await goBtn.asElement().click();

  let toastOk = false;
  try {
    await page.waitForFunction(() => document.body.innerText.includes("Plano enviado com sucesso"), { timeout: 25000 });
    toastOk = true;
  } catch { /* abaixo */ }
  step("3. template aplicado (toast)", toastOk);

  // valida no banco: último programa do aluno = Glúteos Foco, exercícios resolvidos
  const loginRes = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@gymfitness.com", password: "teste1234" }),
  });
  const jwt = (await loginRes.json()).access_token;
  const H = { apikey: ANON, Authorization: `Bearer ${jwt}` };
  const prog = await (await fetch(`${SUPA}/rest/v1/workout_programs?select=id,name&order=created_at.desc&limit=1`, { headers: H })).json();
  const isGlu = prog[0]?.name?.includes("Glúteos");
  step("4. programa criado com nome do template", isGlu, prog[0]?.name);
  const days = await (await fetch(`${SUPA}/rest/v1/workout_days?select=id&program_id=eq.${prog[0].id}`, { headers: H })).json();
  const exs = await (await fetch(`${SUPA}/rest/v1/workout_exercises?select=exercises(name)&day_id=in.(${days.map((d) => d.id).join(",")})`, { headers: H })).json();
  const unresolved = exs.filter((e) => !e.exercises?.name || e.exercises?.name === "Abdominal crunch");
  step("5. exercícios do template resolvidos no banco", exs.length >= 4 && unresolved.length === 0, `${exs.length} exercícios, ${unresolved.length} placeholders`);

  step("6. zero erros de JS", jsErrors.length === 0, jsErrors.join(" | "));
} catch (e) {
  step("EXCEÇÃO", false, String(e).slice(0, 200));
}

await browser.close();
console.log(`\n=== TEMPLATE: ${results.filter(Boolean).length}/${results.length} PASS ===`);
process.exit(results.every(Boolean) ? 0 : 1);
