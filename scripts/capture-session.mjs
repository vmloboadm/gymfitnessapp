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

  await page.goto(BASE + "/treino", { waitUntil: "networkidle2", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2500));

  const clicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, a")];
    const btn = els.find((e) => /iniciar/i.test(e.textContent ?? ""));
    if (btn) {
      btn.scrollIntoView({ block: "center" });
      btn.click();
      return true;
    }
    return false;
  });
  console.log("clicou Iniciar:", clicked);
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));

  await page.screenshot({ path: "docs/proofs/10-sessao-ativa-topo.png" });

  // marca séries 1 e 2 pelos aria-labels
  for (const n of [1, 2]) {
    const ok = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="toque para marcar" i]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`marcou série ${n}:`, ok);
    await new Promise((r) => setTimeout(r, 400));
  }
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "docs/proofs/11-sessao-ativa-serie.png" });

  // rola até o fim pra ver o CTA + próximo exercício
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "docs/proofs/12-sessao-ativa-cta.png" });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
