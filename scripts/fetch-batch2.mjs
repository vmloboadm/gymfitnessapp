/** Lote 2: exercícios do treino demo diário. Mesmo pipeline do lote 1. */
import { mkdirSync } from "node:fs";

const OUT = "scripts/exercise-img-out";
mkdirSync(OUT, { recursive: true });
const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" };

const EXERCISES = [
  { slug: "agachamento-livre", term: "barbell squat", candidate: 0 },
  { slug: "desenvolvimento-militar", term: "overhead press barbell", candidate: 0 },
  { slug: "puxada-alta", term: "lat pulldown", candidate: 0 },
  { slug: "esteira", term: "treadmill running", candidate: 0 },
  { slug: "rosca-direta", term: "barbell curl", candidate: 0 },
  { slug: "triceps-corda", term: "triceps pushdown", candidate: 0 },
  { slug: "leg-press-45", term: "leg press machine", candidate: 0 },
  { slug: "prancha-isometrica", term: "plank exercise", candidate: 0 },
];

async function searchCommons(term) {
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&srlimit=8&format=json&origin=*`;
  const res = await fetch(url, { headers: UA });
  const json = await res.json();
  return (json.query?.search ?? []).map((r) => r.title).filter((t) => /\.(jpe?g|png)$/i.test(t));
}

async function thumbFor(fileTitle, width = 640) {
  const url = `${API}?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${width}&format=json&origin=*`;
  const res = await fetch(url, { headers: UA });
  const json = await res.json();
  const ii = Object.values(json.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!ii || !/image\/(jpeg|png)/.test(ii.mime ?? "") || (ii.thumbwidth ?? ii.width) < 400) return null;
  return ii.thumburl ?? ii.url;
}

const results = [];
for (const ex of EXERCISES) {
  try {
    const files = await searchCommons(ex.term);
    let buf = null;
    let used = null;
    for (let off = 0; off < files.length && !buf; off++) {
      const idx = (ex.candidate + off) % files.length;
      const thumb = await thumbFor(files[idx]);
      if (!thumb) continue;
      const res = await fetch(thumb, { headers: UA });
      if (!res.ok) continue;
      const b = Buffer.from(await res.arrayBuffer());
      if (b.length > 8000) {
        buf = b;
        used = files[idx];
      }
    }
    if (buf) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(`${OUT}/${ex.slug}.src`, buf);
      results.push({ slug: ex.slug, status: "ok", file: used });
    } else {
      results.push({ slug: ex.slug, status: "sem download" });
    }
  } catch (e) {
    results.push({ slug: ex.slug, status: `erro: ${String(e).slice(0, 50)}` });
  }
}
console.table(results);
