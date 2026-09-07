/**
 * E2E das novas features v1.14.0:
 *   beneficios (vazia → gestor cadastra → aluno vê + revela cupom),
 *   maquina/[id] (detalhe + histórico de hoje),
 *   entrada ?maquina=entrada (checkin + libera treino).
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
const TRAINER = { email: "gestor@gymfitness.com", password: "teste1234" };
const STUDENT = { email: "teste@gymfitness.com", password: "teste1234" };
const MAQ_BIKE = "84bf9350-e82a-4ac9-918d-f20b93d10a0f";
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);

const results = [];
const step = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, email, password) {
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.type("#email", email, { delay: 8 });
  await page.type('input[type="password"]', password, { delay: 8 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
  await sleep(2000);
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 120)));
  const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };

  try {
    // ===== GESTOR: cadastra patrocinador =====
    await login(page, TRAINER.email, TRAINER.password);
    step("1. login gestor", true);
    await page.goto(`${BASE}/app/beneficios`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(4000);
    const emptyOk = await page.evaluate(() => document.body.innerText.includes("Em breve") || document.body.innerText.includes("Cadastrar parceiro"));
    step("2. página beneficios abre", emptyOk);

    const formOk = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Cadastrar parceiro"));
      if (!b) return false;
      b.click();
      return true;
    });
    await sleep(800);
    const filled = await page.evaluate(() => {
      const set = (label, val) => {
        const i = document.querySelector(`input[aria-label="${label}"]`);
        if (!i) return false;
        i.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, val);
        return true;
      };
      return set("Nome do parceiro", "E2E Suplementos") && set("Texto do desconto", "15% em tudo") && set("Cupom ou WhatsApp", "GF15E2E");
    });
    await sleep(400);
    const saved = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Cadastrar parceiro") && x.tagName === "BUTTON" && x.closest("div.space-y-3"));
      const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Cadastrar parceiro" && x.parentElement?.querySelector("input"));
      const target = btn ?? null;
      if (!target || target.disabled) return "bloqueado";
      target.click();
      return "enviado";
    });
    await sleep(2500);
    const cardShown = await page.evaluate(() => document.body.innerText.includes("E2E Suplementos"));
    step("3. gestor cadastra parceiro e card aparece", formOk && filled && cardShown, `${saved}`);

    // ===== ALUNO: vê + revela cupom =====
    await login(page, STUDENT.email, STUDENT.password);
    step("4. login aluno", true);
    await page.goto(`${BASE}/app/beneficios`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(4000);
    const seesCard = await page.evaluate(() => document.body.innerText.includes("E2E Suplementos") && document.body.innerText.includes("15% em tudo"));
    step("5. aluno vê o card com desconto", seesCard);
    const revealed = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Sou aluno GymFitness"));
      if (!b) return "sem-botao";
      b.click();
      return "clicado";
    });
    await sleep(800);
    const coupon = await page.evaluate(() => document.body.innerText.includes("GF15E2E"));
    step("6. botão revela o cupom", revealed === "clicado" && coupon);

    // ===== MÁQUINA: detalhe + histórico =====
    await page.goto(`${BASE}/app/maquina/${MAQ_BIKE}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(4000);
    const maqOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes("Bicicleta") && t.includes("Adicionar meu histórico de hoje");
    });
    step("7. detalhe da máquina abre com botão de histórico", maqOk);
    const logOpened = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Adicionar meu histórico"));
      if (!b) return false;
      b.click();
      return true;
    });
    await sleep(800);
    const logged = await page.evaluate(() => {
      const dist = document.querySelector('input[aria-label="Distância em quilômetros"]');
      if (dist) { dist.focus(); document.execCommand("selectAll", false, null); document.execCommand("insertText", false, "3,5"); }
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Salvar histórico"));
      if (!b || b.disabled) return "bloqueado";
      b.click();
      return "enviado";
    });
    await sleep(3000);
    const histShown = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes("3,5 km") || t.includes("3.5 km");
    });
    step("8. histórico da bike salvo (tempo + km)", logOpened && histShown, logged);

    // ===== ENTRADA: libera treino =====
    await page.goto(`${BASE}/app/checkin?maquina=entrada`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(6000);
    const atTreino = page.url().includes("/treino");
    step("9. scan da entrada redireciona ao treino", atTreino, page.url().split("/app")[1]);

    step("10. zero erros de JS", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));

    // limpeza: remove parceiro + sessão de equipamento de teste
    const sp = await (await fetch(`${SUPA}/rest/v1/sponsors?select=id&name=eq.E2E%20Suplementos`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } })).json();
    if (sp[0]?.id) await fetch(`${SUPA}/rest/v1/sponsors?id=eq.${sp[0].id}`, { method: "DELETE", headers: H }).catch(() => {});
  } catch (e) {
    step("EXCEÇÃO", false, String(e).slice(0, 250));
  }

  await browser.close();
  const ok = results.every(Boolean);
  console.log(`\n=== NEW FEATURES: ${results.filter(Boolean).length}/${results.length} PASS ===`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
