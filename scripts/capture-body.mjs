import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_URL || "http://localhost:3000";
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

  // rola até o explorador
  const found = await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2")].find((h) => /biblioteca por músculo/i.test(h.textContent ?? ""));
    if (el) {
      el.scrollIntoView({ block: "start" });
      return true;
    }
    return false;
  });
  console.log("explorador encontrado:", found);
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: "docs/proofs/20-bodyexplorer-frente.png" });

  // toca no peito (primeiro hotspot) — clica por aria-label
  const tapped = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Peitoral" i]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("tocou Peitoral:", tapped);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/21-bodyexplorer-peito.png" });

  // vira pra costas e fotografa
  const flipped = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="vista de costas" i]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("virou costas:", flipped);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/22-bodyexplorer-costas.png" });

  // toca no trapézio
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Trapézio" i]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/23-bodyexplorer-trapezio.png" });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
