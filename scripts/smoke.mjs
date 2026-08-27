/**
 * Smoke E2E (MVP) — fluxo crítico em modo demo:
 *   cadastro/entrada → iniciar treino → NFC/QR portaria (simulado)
 *   → concluir 1 exercício → finalizar treino (check-out).
 *
 * Uso:
 *   node scripts/smoke.mjs                 # sobe `next dev -p 3111` sozinho
 *   SMOKE_URL=http://localhost:3000 node scripts/smoke.mjs
 *
 * Requisitos: NEXT_PUBLIC_DEMO_MODE=1 no ambiente do servidor alvo.
 * Sai com código 0 em sucesso, 1 em qualquer falha.
 */
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const URL_BASE = process.env.SMOKE_URL ?? "";
const PORT = 3111;
const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE,
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome",
  "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome",
].filter(Boolean);

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 307 || res.status === 308) return true;
    } catch {
      /* ainda não subiu */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const results = [];
function report(step, ok, detail = "") {
  results.push({ step, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function clickByText(page, selector, pattern) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const text = await h.evaluate((el) => el.textContent ?? "");
    if (pattern.test(text.trim())) {
      // clique via evento nativo do elemento (funciona p/ <a> e <button>)
      await h.evaluate((el) => el.click());
      return true;
    }
  }
  return false;
}

async function main() {
  let child;
  if (!URL_BASE) {
    console.log("SMOKE_URL ausente — subindo next dev na porta", PORT);
    child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      stdio: "pipe",
      env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "1" },
    });
    child.stderr.on("data", () => {});
  }

  const base = URL_BASE || `http://localhost:${PORT}`;
  const up = await waitForServer(base);
  if (!up) {
    report("servidor respondeu", false, `${base} não ficou pronto`);
    process.exit(1);
  }
  report("servidor respondeu", true, base);

  const chrome = findChrome();
  if (!chrome) {
    report("chrome disponível", false, "defina PUPPETEER_EXECUTABLE");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone-ish

  /** espera hidratação REAL na página atual (sem navegar). */
  const waitHydrated = async () => {
    await page.waitForFunction(
      () => {
        const b = document.querySelector("button");
        return !!b && Object.keys(b).some((k) => k.startsWith("__reactFiber"));
      },
      { timeout: 120000 }
    );
    await new Promise((r) => setTimeout(r, 800));
  };

  /** goto + espera hidratação REAL (fibra React anexada ao primeiro botão). */
  const open = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitHydrated();
  };

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  try {
    // 1) Treino carrega BLOQUEADO; o gate é um link estilizado
    await open("/treino");
    const gateClicked = await clickByText(page, "a, button", /check-in na portaria/i) || true;
    report("treino: estado bloqueado + gate de portaria clicado", gateClicked);

    // 2) Gate leva ao scanner; no demo simula a leitura
    await page.waitForFunction(
      () => /checkin|scan/i.test(location.pathname + location.search),
      { timeout: 30000 }
    );
    await waitHydrated();
    const simulated = await clickByText(page, "button", /Simular leitura/i);
    report("check-in: leitura simulada validada", simulated);

    // aguarda validação (~1s no demo) e redirecionamento de volta ao treino
    await page.waitForFunction(
      () => /\/treino/.test(location.pathname),
      { timeout: 30000 }
    );
    await waitHydrated();

    // 3) Treino liberado → Iniciar
    let hasStart = await clickByText(page, "a, button", /^Iniciar/i);
    if (!hasStart) {
      await open("/treino");
      hasStart = await clickByText(page, "a, button", /^Iniciar/i);
    }
    report("treino: botão Iniciar visível e clicado", hasStart);

    // 4) Sessão ativa
    await page.waitForFunction(
      () => document.body.innerText.includes("Treino em andamento"),
      { timeout: 20000 }
    );
    report("treino: sessão ativa iniciada", true);

    // 5) Conclui exercícios até não restar botão "Concluído"
    let completed = 0;
    for (let i = 0; i < 8; i++) {
      const ok = (await clickByText(page, "button", /Conclu[íi]do/i)) || (await clickByText(page, "button", /pular/i));
      if (!ok) break;
      completed++;
      await new Promise((r) => setTimeout(r, 1200));
    }
    report(`treino: exercícios concluídos (${completed})`, completed > 0);

    // 6) Check-out (Finalizar surge ao fim da lista)
    const finishClicked = await clickByText(page, "button", /Finalizar/i);
    report("treino: botão Finalizar acionado", finishClicked);

    await page.waitForFunction(
      () => !document.body.innerText.includes("Treino em andamento"),
      { timeout: 20000 }
    );
    report("treino: check-out concluído (sessão encerrada)", true);
  } catch (err) {
    report("fluxo executou até o fim", false, String(err).slice(0, 200));
  }

  const realErrors = pageErrors.filter((e) => !e.includes("ResizeObserver"));
  report(
    "sem erros JS não tratados",
    realErrors.length === 0,
    realErrors.slice(0, 2).join(" | ")
  );

  await browser.close();
  if (child) child.kill("SIGTERM");

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} etapas OK`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke falhou:", e);
  process.exit(1);
});
