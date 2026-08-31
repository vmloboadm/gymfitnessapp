/**
 * Bulk: compõe (início→contração) TODOS os exercícios da Everkinetic que
 * ainda não têm composição, salva como evk-{id_num}.webp e sobe pro Storage.
 * Uso: node scripts/everkinetic-bulk.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "scripts/everkinetic-out";
mkdirSync(OUT, { recursive: true });
const RAW = "https://raw.githubusercontent.com/everkinetic/data/main/dist/svg";
const IDX_URL = "https://raw.githubusercontent.com/everkinetic/data/main/exercises.json";
const ST = "https://jeixbpucnxrhizqpapyv.supabase.co/storage/v1/object/exercise-images";
const UA = { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" };
const AUTH = {
  apikey: process.env.SUPA_SECRET ?? "",
  Authorization: `Bearer ${process.env.SUPA_SECRET ?? ""}`,
  "Content-Type": "image/webp",
  "x-upsert": "true",
};

const SETA = Buffer.from(
  `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><path d="M8 32 H44 M34 16 L50 32 L34 48" stroke="#F4711E" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
);

async function fetchBuf(url, cacheName) {
  const cache = `${OUT}/_cache_${cacheName}`;
  if (existsSync(cache)) return readFileSync(cache);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(cache, buf);
  return buf;
}

async function framePng(buf, size = 184) {
  return sharp(buf, { density: 260 })
    .trim({ threshold: 12 })
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

async function main() {
  const all = JSON.parse(readFileSync("/tmp/evk-exercises.json", "utf8"));
  const index = all.find((e) => e.id_num === "0042") ? all : JSON.parse(await (await fetch(IDX_URL, { headers: UA })).text());

  const seta = await sharp(SETA, { density: 150 }).resize(56, 56).png().toBuffer();
  let ok = 0, skip = 0, fail = 0;

  for (const ex of index) {
    const id = ex.id_num;
    const outPath = `${OUT}/evk-${id}.webp`;
    if (existsSync(outPath)) { skip++; continue; }
    try {
      // verifica frames: padrão svg primeiro; fallback img paths (png)
      const imgs = Array.isArray(ex.img) ? ex.img : [];
      const f1 = `${RAW}/${id}-relaxation.svg`;
      const f2 = `${RAW}/${id}-tension.svg`;
      let bufA, bufB;
      try {
        [bufA, bufB] = await Promise.all([fetchBuf(f1, `${id}-relaxation.svg`), fetchBuf(f2, `${id}-tension.svg`)]);
      } catch {
        // fallback: _images/web/{name}-1.png / -2.png
        const p1 = imgs[0] ? String(imgs[0]).replace("_images/web/", "") : null;
        const p2 = imgs[1] ? String(imgs[1]).replace("_images/web/", "") : null;
        if (!p1 || !p2) throw new Error("sem frames");
        [bufA, bufB] = await Promise.all([
          fetchBuf(`https://raw.githubusercontent.com/everkinetic/data/main/_images/web/${p1}`, `${id}-relaxation.png`),
          fetchBuf(`https://raw.githubusercontent.com/everkinetic/data/main/_images/web/${p2}`, `${id}-tension.png`),
        ]);
      }
      const [pngA, pngB, seta2] = [await framePng(bufA), await framePng(bufB), seta];
      const webp = await sharp({ create: { width: 400, height: 400, channels: 4, background: "#ffffff" } })
        .composite([
          { input: pngA, top: 108, left: 14 },
          { input: seta2, top: 172, left: 172 },
          { input: pngB, top: 108, left: 202 },
        ])
        .webp({ quality: 70 })
        .toBuffer();
      writeFileSync(outPath, webp);

      const up = await fetch(`${ST}/evk-${id}.webp`, { method: "POST", headers: AUTH, body: webp });
      if (up.ok || up.status === 200) ok++;
      else { fail++; console.log(`upload ✗ evk-${id}: ${up.status}`); }
    } catch (e) {
      fail++;
      console.log(`${id} ${ex.title} ✗ ${String(e).slice(0, 50)}`);
    }
  }
  console.log(`\nbulk concluído: ${ok} novos, ${skip} já existiam, ${fail} falhas`);
}

main().catch((e) => { console.error(e); process.exit(1); });
