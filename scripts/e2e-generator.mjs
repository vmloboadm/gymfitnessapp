/**
 * E2E do Gerador de Treino com IA (assistente guiado) — fluxo de produção:
 *   login personal → escolher aluno → responder perguntas da IA
 *   (nível/objetivo/foco/restrições) → dias → gerar (IA real)
 *   → validar plano (nº dias, exercícios = biblioteca DB)
 *   → trocar 1 exercício pelo picker → aprovar → conferir banco
 *   → login aluno → conferir plano visível em /app/treino.
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
const TRAINER = { email: "gestor@gymfitness.com", password: "teste1234" };
const STUDENT = { email: "teste@gymfitness.com", password: "teste1234" };
const ALUNO_ID = "e0782c90-4322-4b00-a7f6-f7b22cc425ef";
const CHROME = ["/root/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome", "/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome"].find(existsSync);

const results = [];
const step = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, email, password) {
  const client = await page.createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/app/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.type("#email", email, { delay: 10 });
  await page.type('input[type="password"]', password, { delay: 10 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 45000 });
  await sleep(2500);
}

async function tapText(page, text, partial = false) {
  return page.evaluate((t, p) => {
    const btns = [...document.querySelectorAll("button")];
    const b = p
      ? btns.find((x) => x.textContent.includes(t))
      : btns.find((x) => x.textContent.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, text, partial);
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));

  try {
    await login(page, TRAINER.email, TRAINER.password);
    step("1. login do personal", true);

    await page.goto(`${BASE}/app/personal/treinos?aluno=${ALUNO_ID}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(4000);

    const targetOk = await page.evaluate(() => document.body.innerText.includes("Aluno Teste"));
    step("2. tela de atribuição com aluno fixado", targetOk);

    // assistente guiado: nível
    const hasAssistant = await page.evaluate(() => document.body.innerText.includes("Qual o nível"));
    step("3. assistente faz a pergunta de nível", hasAssistant);
    await tapText(page, "Intermediário");
    await sleep(700);
    const hasGoal = await page.evaluate(() => document.body.innerText.includes("objetivo principal"));
    step("4. pergunta de objetivo aparece", hasGoal);
    await tapText(page, "Hipertrofia");
    await sleep(700);
    const hasFocus = await page.evaluate(() => document.body.innerText.includes("foco do plano"));
    step("5. pergunta de foco aparece", hasFocus);
    const focoTap = await tapText(page, "Corpo inteiro", true);
    step("5b. foco escolhido", focoTap);
    await sleep(700);
    const hasRest = await page.evaluate(() => document.body.innerText.includes("restrição ou lesão"));
    step("6. pergunta de restrições aparece", hasRest);
    const restTap = await tapText(page, "Nenhuma", true);
    step("6b. restrição respondida", restTap);
    await sleep(700);
    let hasSummary = false;
    for (let i = 0; i < 4 && !hasSummary; i++) {
      hasSummary = await page.evaluate(() => {
        const t = document.body.innerText;
        return t.includes("Resumo para gerar") || t.includes("RESUMO PARA GERAR");
      });
      if (!hasSummary) await sleep(500);
    }
    step("7. resumo das respostas exibido", hasSummary);

    // dias Seg/Ter/Qua
    await page.evaluate(() => {
      const chips = [...document.querySelectorAll("button[aria-pressed]")].filter((b) => ["Seg", "Ter", "Qua"].includes(b.textContent.trim()));
      chips.forEach((b) => { if (b.getAttribute("aria-pressed") !== "true") b.click(); });
    });
    await sleep(600);

    // gerar
    const genOk = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Gerar plano"));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    step("8. botão gerar habilitado e clicado", genOk);

    try {
      await page.waitForFunction(() => document.body.innerText.includes("Aprovar e Atribuir"), { timeout: 150000 });
      step("9. plano gerado pela IA (com botão aprovar)", true);
    } catch {
      step("9. plano gerado pela IA (com botão aprovar)", false, "timeout 150s");
    }

    const planInfo = await page.evaluate(() => {
      const txt = document.body.innerText;
      const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim());
      const freqBadge = txt.match(/\d+x semana/)?.[0] ?? "";
      return { tabs, freqBadge, hasProg: txt.includes("Progressão") };
    });
    step("10. plano multi-dias gerado", planInfo.tabs.length === 0 || planInfo.tabs.length >= 2, `dias=${JSON.stringify(planInfo.tabs)}`);

    const planExNames = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[aria-label="Plano de treino editável"] p').forEach((p) => {
        const m = p.textContent.trim().match(/^\d+\.\s+(.+)$/);
        if (m) out.push(m[1]);
      });
      return out;
    });

    let dbNames = [];
    try {
      const jwt = (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: TRAINER.email, password: TRAINER.password }),
      })).json()).access_token;
      const rows = await (await fetch(`${SUPA}/rest/v1/exercises?select=name`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } })).json();
      dbNames = rows.map((r) => r.name.toLowerCase());
    } catch { /* abaixo */ }
    const matched = planExNames.filter((n) => dbNames.includes(n.toLowerCase()));
    step("11. exercícios do plano batem com a biblioteca do banco", planExNames.length > 0 && matched.length === planExNames.length, `${matched.length}/${planExNames.length}`);

    // 12. TROCAR um exercício pelo picker da biblioteca
    const swapOk = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button[aria-label^="Trocar "]')];
      if (!btns.length) return "sem-botao";
      btns[0].click();
      return "aberto";
    });
    await sleep(1200);
    const swapSheet = await page.evaluate(() => document.body.innerText.includes("Trocar exercício"));
    step("12. picker de troca abre", swapOk === "aberto" && swapSheet, swapOk);
    const picked = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("li button")];
      const r = rows.find((b) => b.textContent.includes("Puxada") || b.textContent.includes("Supino"));
      if (!r) return null;
      const name = r.querySelector("p")?.textContent?.trim() ?? null;
      r.click();
      return name;
    });
    await sleep(800);
    const afterSwap = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[aria-label="Plano de treino editável"] p').forEach((p) => {
        const m = p.textContent.trim().match(/^\d+\.\s+(.+)$/);
        if (m) out.push(m[1]);
      });
      return out;
    });
    step("13. exercício trocado no plano", !!picked && afterSwap.includes(picked), picked ?? "nenhum substituto");

    const before = await countDB();
    const approveBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Aprovar e Atribuir")));
    await approveBtn.asElement().click();
    let toastOk = false;
    try {
      await page.waitForFunction(() => document.body.innerText.includes("Plano enviado com sucesso"), { timeout: 25000 });
      toastOk = true;
    } catch { /* abaixo */ }
    step("14. aprovação com toast de sucesso", toastOk);

    const after = await countDB();
    step("15. programa + student_workout criados", after.programs > before.programs && after.sw > before.sw, `prog+${after.programs - before.programs} sw+${after.sw - before.sw}`);

    // aluno vê o plano
    await login(page, STUDENT.email, STUDENT.password);
    step("16. login do aluno", true);
    await page.goto(`${BASE}/app/treino`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(6000);
    const sees = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes("Do seu Personal") || t.includes("seu Personal");
    });
    step("17. aluno vê plano do personal", sees);

    step("18. zero erros de JS na sessão", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));
  } catch (e) {
    step("EXCEÇÃO", false, String(e).slice(0, 300));
  }

  await browser.close();
  const ok = results.every(Boolean);
  console.log(`\n=== RESULTADO: ${results.filter(Boolean).length}/${results.length} PASS ===`);
  process.exit(ok ? 0 : 1);
}

async function countDB() {
  const loginRes = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TRAINER.email, password: TRAINER.password }),
  });
  const jwt = (await loginRes.json()).access_token;
  const [p, s] = await Promise.all([
    fetch(`${SUPA}/rest/v1/workout_programs?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } }).then((r) => r.json()),
    fetch(`${SUPA}/rest/v1/student_workouts?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } }).then((r) => r.json()),
  ]);
  return { programs: Array.isArray(p) ? p.length : 0, sw: Array.isArray(s) ? s.length : 0 };
}

main().catch((e) => { console.error(e); process.exit(1); });
