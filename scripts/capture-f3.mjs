import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_URL || "http://localhost:3002";
const CHROME = [
  process.env.PUPPETEER_EXECUTABLE,
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
].find((p) => existsSync(p));

async function snap(browser, url, name, wait = 1800) {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, wait));
  // expande o primeiro acordeão do grupo se existir
  await page.evaluate(() => {
    const btn = document.querySelector('[role="button"][data-state="closed"], button[data-state="closed"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: `docs/proofs/${name}.png` });
  await page.close();
  console.log("captured", name);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  await snap(browser, "/equipamento?grupo=perna", "50-catalogo-perna");
  await snap(browser, "/equipamento?grupo=cardio", "51-catalogo-cardio");
  await snap(browser, "/equipamento?grupo=costas", "52-catalogo-costas");
  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
