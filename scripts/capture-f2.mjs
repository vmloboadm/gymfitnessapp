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

  const found = await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2")].find((h) => /biblioteca por músculo/i.test(h.textContent ?? ""));
    if (el) {
      el.scrollIntoView({ block: "start" });
      return true;
    }
    return false;
  });
  console.log("mapa encontrado:", found);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/40-bodymap-frente.png" });

  // toca no peito direto no modelo (primeiro path clicável)
  const tapped = await page.evaluate(() => {
    const svg = document.querySelector("svg[style*='cursor'] path, svg path");
    const paths = [...document.querySelectorAll("svg path")].filter((p) => p.style.cursor !== "default");
    const target = paths[0] ?? document.querySelector("svg path");
    if (target) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    return false;
  });
  console.log("tocou no modelo:", tapped);
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: "docs/proofs/41-bodymap-selecao.png" });

  // chips de grupo: Pernas
  const chip = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Pernas");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("chip Pernas:", chip);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/42-bodymap-sheet.png" });

  // fecha sheet pela X e gira pra costas
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const x = btns.reverse().find((b) => (b.getAttribute("aria-label") ?? "").toLowerCase().includes("fechar") || /close/i.test(b.getAttribute("aria-label") ?? ""));
    if (x) x.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  const flipped = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /girar/i.test(b.textContent ?? ""));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("girou:", flipped);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "docs/proofs/43-bodymap-costas.png" });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
