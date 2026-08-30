import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_URL || "http://localhost:3002";
const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE,
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome",
].filter(Boolean);

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto(BASE + "/treino", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  // inicia treino
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /iniciar treino/i.test(b.textContent ?? ""));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // marca 2 séries
  const nBtns = await page.evaluate(() => document.querySelectorAll('button[aria-label^="Marcar série" i]').length);
  console.log("botões de série na página:", nBtns);
  console.log("body tem Iniciar? ", await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, " | ")));
  for (let i = 0; i < 2; i++) {
    const ok = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label^="Marcar série" i]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`clique série ${i + 1}:`, ok);
  }
  const dump = (label) => page.evaluate((l) => {
    const raw = localStorage.getItem("gymfit_session_progress_v1");
    if (!raw) return `${l}: NULL`;
    const p = JSON.parse(raw);
    const done = Object.values(p.progress || {}).reduce((a, e) => a + (e.sets || []).filter((x) => x.done).length, 0);
    return `${l}: doneSets=${done} currentIdx=${p.currentIdx} exs=${(p.exercises || []).length}`;
  }, label);
  console.log(await dump("apos-marcar"));

  // minimiza
  const minimized = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Minimizar treino" i]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("minimizou:", minimized);
  console.log(await dump("apos-minimizar"));
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/proofs/30-liveworkoutbar-home.png" });

  // volta pela barra
  const returned = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Treino em andamento" i]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("voltou pela barra:", returned);
  await new Promise((r) => setTimeout(r, 800));
  console.log(await dump("de-volta-treino"));
  await new Promise((r) => setTimeout(r, 1500));

  // continua treino
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /continuar treino/i.test(b.textContent ?? ""));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log(await dump("apos-continuar"));
  await page.screenshot({ path: "docs/proofs/31-sessao-restaurada.png" });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
