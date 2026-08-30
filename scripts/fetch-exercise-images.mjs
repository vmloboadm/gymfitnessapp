/**
 * F4 pipeline (parte 1): busca no Wikimedia Commons, baixa e converte
 * para WebP 400px q70. NÃO faz upload — upload só após aprovação visual.
 *
 * Uso: node scripts/fetch-exercise-images.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const OUT = "scripts/exercise-img-out";
mkdirSync(OUT, { recursive: true });

const API = "https://commons.wikimedia.org/w/api.php";

/** slug → termo de busca + índice do candidato (ajustável após revisão visual) */
const EXERCISES = [
  { slug: "supino-reto", term: "bench press athlete", candidate: 0 },
  { slug: "supino-inclinado", term: "incline bench press", candidate: 0 },
  { slug: "supino-declinado", term: "bench press gym man", candidate: 1 },
  { slug: "supino-com-halteres", term: "dumbbell chest press lying", candidate: 0 },
  { slug: "crucifixo-com-halteres", term: "dumbbell fly exercise", candidate: 0 },
  { slug: "crucifixo-polia", term: "cable machine exercise", candidate: 0 },
  { slug: "voador-peck-deck", term: "butterfly chest machine", candidate: 1 },
  { slug: "flexao-de-braco", term: "push-up", candidate: 1 },
  { slug: "fundos-paralelas", term: "dips exercise parallel bars", candidate: 0 },
];

async function searchCommons(term) {
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&srlimit=8&format=json&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" } });
  const json = await res.json();
  return (json.query?.search ?? [])
    .map((r) => r.title)
    .filter((t) => /\.(jpe?g|png)$/i.test(t));
}

async function thumbFor(fileTitle, width = 640) {
  const url = `${API}?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${width}&format=json&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" } });
  const json = await res.json();
  const page = Object.values(json.query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  if (!/image\/(jpeg|png)/.test(ii.mime ?? "")) return null;
  if ((ii.thumbwidth ?? ii.width) < 400) return null;
  return ii.thumburl ?? ii.url;
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 8000 ? buf : null;
}

const results = [];
for (const ex of EXERCISES) {
  const outPath = `${OUT}/${ex.slug}.webp`;
  if (existsSync(outPath)) {
    results.push({ ...ex, status: "já existe (skip)" });
    continue;
  }
  try {
    const files = await searchCommons(ex.term);
    if (files.length === 0) {
      results.push({ ...ex, status: "sem resultados" });
      continue;
    }
    let buf = null;
    let used = null;
    // tenta a partir do candidato escolhido; se falhar, anda a lista
    for (let off = 0; off < files.length && !buf; off++) {
      const idx = (ex.candidate + off) % files.length;
      const thumb = await thumbFor(files[idx]);
      if (!thumb) continue;
      buf = await download(thumb);
      if (buf) used = files[idx];
    }
    if (!buf) {
      results.push({ ...ex, status: "download falhou" });
      continue;
    }
    // grava o bruto p/ o sharp rodar no passo de conversão (mantém script puro-ESM leve)
    writeFileSync(`${OUT}/${ex.slug}.src`, buf);
    results.push({ ...ex, status: "ok", file: used });
  } catch (e) {
    results.push({ ...ex, status: `erro: ${String(e).slice(0, 60)}` });
  }
}

console.table(results.map((r) => ({ slug: r.slug, status: r.status, file: r.file ?? "" })));
