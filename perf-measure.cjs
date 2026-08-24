const puppeteer = require('puppeteer-core');
const CHROME = '/root/.cache/puppeteer/chrome/linux-152.0.7977.42/chrome-linux64/chrome';
const BASE = process.argv[2] || 'http://localhost:3000';
const ROUTES = ['/', '/treino', '/progresso'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-gpu'] });
  const results = [];
  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.emulate({ viewport: { width: 360, height: 740, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 11) Chrome/120 Mobile' });
    const cdp = await page.target().createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // captura FCP via PerformanceObserver antes do goto
    await page.evaluateOnNewDocument(() => {
      window.__fcp = 0;
      new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) window.__fcp = e[e.length - 1].startTime; }).observe({ type: 'paint', buffered: true });
    });
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    const m = await page.metrics();
    const fcp = await page.evaluate(() => Math.round(window.__fcp || 0));
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.loadEventEnd) : 0; });
    results.push({ route, loadMs: nav, FCPms: fcp, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1) });
    await page.close();
  }
  console.log(JSON.stringify(results));
  await browser.close();
})();
