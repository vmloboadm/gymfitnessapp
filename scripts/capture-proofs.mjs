import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";

const BASE = process.env.AUDIT_URL || "http://localhost:3000";
const OUT = "docs/proofs";
mkdirSync(OUT, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE,
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome",
].filter(Boolean);

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function capture(path, name, opts = {}) {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500));
  // espera conteúdo chave renderizar (client-side)
  try { await page.waitForSelector('h1, h2, [data-testid]', { timeout: 3000 }); } catch {}
  await new Promise(r => setTimeout(r, 800));
  if (opts.click) {
    try { await page.click(opts.click); await new Promise(r => setTimeout(r, 1200)); } catch {}
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`captured ${name}.png`);
  await browser.close();
}

async function main() {
  const chrome = findChrome();
  if (!chrome) { console.error("chrome not found"); process.exit(1); }
  console.log("using chrome", chrome);
  await capture("/login", "01-login-cinematic", {});
  await capture("/", "02-dashboard-ring-flame", {});
  await capture("/treino", "03-treino-lista-icones", {});
  // treino ativo: precisa clicar Iniciar se demo
  await capture("/treino", "04-treino-ativo", { click: 'button:has-text("Iniciar")' });
  await capture("/treino", "05-planos-sheet", { click: 'button:has-text("Full Body")' });
  console.log("done");
}

main().catch(e => { console.error(e); process.exit(1); });
