import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = process.env.SMOKE_URL ?? "http://localhost:3003";
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 150)));

// login como aluno
const client = await page.createCDPSession();
await client.send("Network.clearBrowserCookies");
await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector("#email", { timeout: 30000 });
await page.type("#email", "teste@gymfitness.com", { delay: 10 });
await page.type('input[type="password"]', "teste1234", { delay: 10 });
await page.click('button[type="submit"]');
await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
await sleep(2000);
console.log("PASS 1. login do aluno");

// abre o treino (bolha do coach está aqui)
await page.goto(`${BASE}/app/treino`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(4000);

// clica na bolha flutuante do coach
const bubble = await page.$('button[aria-label*="Assistente"]');
if (!bubble) { console.log("FAIL 2. bolha do coach não encontrada"); process.exit(1); }
await bubble.click();
await sleep(1000);

// clica numa pergunta rápida
const quick = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Posso treinar perna hoje?")));
if (quick.asElement()) {
  await quick.asElement().click();
  console.log("PASS 2. pergunta rápida enviada");
} else {
  console.log("FAIL 2. botão de pergunta rápida não encontrado");
}

// espera resposta da IA (streaming)
let aiText = "";
try {
  await page.waitForFunction(() => {
    const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")];
    return bubbles.slice(1).some((b) => b.textContent.trim().length > 5 && !b.textContent.includes("offline"));
  }, { timeout: 90000 });
  aiText = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")];
    return bubbles.filter((b) => !b.textContent.includes("assistente de treino")).map((b) => b.textContent.trim()).join(" ||| ");
  });
  console.log(`PASS 3. resposta da IA recebida (${aiText.length} chars)`);
  console.log("  IA:", aiText.slice(0, 400));
} catch {
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log("FAIL 3. sem resposta da IA em 60s");
  console.log("  body:", txt.replace(/\n+/g, " | ").slice(0, 500));
}

// pergunta de contexto: valida se a IA usa dados do aluno (plano ativo)
// espera o stream da Q1 estabilizar antes de digitar
const q2 = await page.$('input[placeholder*="Pergunte"]');
if (q2 && aiText) {
  try {
    await page.waitForFunction(() => {
      const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")];
      const last = bubbles[bubbles.length - 1]?.textContent ?? "";
      (window).__lastCoachLen = (window).__lastCoachLen ?? {};
      const key = last.length;
      const now = Date.now();
      if ((window).__lastCoachKey !== key) {
        (window).__lastCoachKey = key;
        (window).__lastCoachTime = now;
        return false;
      }
      return now - (window).__lastCoachTime > 5000;
    }, { timeout: 60000 });
  } catch { /* segue mesmo assim */ }
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Pergunte"]');
    if (!input) return;
    input.focus();
    document.execCommand("selectAll", false, null);
  });
  await q2.click();
  await page.keyboard.type("Qual o nome do meu treino atual?", { delay: 15 });
  await sleep(500);
  const sendBtn = await page.evaluateHandle(() => document.querySelector('input[placeholder*="Pergunte"]')?.closest("form")?.querySelector('button[type="submit"]'));
  await sendBtn.asElement().click();
  try {
    await page.waitForFunction(() => {
      const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")];
      return bubbles.length >= 4 && bubbles[bubbles.length - 1].textContent.trim().length > 5;
    }, { timeout: 90000 });
    const last = await page.evaluate(() => {
      const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")];
      return bubbles[bubbles.length - 1].textContent.trim();
    });
    console.log(`PASS 4. segunda resposta (${last.length} chars):`, last.slice(0, 250));
  } catch {
    const dbg = await page.evaluate(() => {
      const bubbles = [...document.querySelectorAll("div.max-w-\\[85\\%\\]")].map((b) => b.textContent.trim().slice(0, 40));
      const input = document.querySelector('input[placeholder*="Pergunte"]');
      const btn = input?.closest("form")?.querySelector('button[type="submit"]');
      return { bubbles, inputVal: input?.value ?? null, btnDisabled: btn?.disabled ?? null };
    });
    console.log("FAIL 4. sem segunda resposta em 90s — debug:", JSON.stringify(dbg));
  }
}

console.log(`erros JS: ${jsErrors.length}${jsErrors.length ? " -> " + jsErrors.join(" | ") : ""}`);
await browser.close();
const pass = aiText.length > 10 && jsErrors.length === 0;
console.log(pass ? "\n=== COACH OK ===" : "\n=== COACH COM FALHAS ===");
process.exit(pass ? 0 : 1);
