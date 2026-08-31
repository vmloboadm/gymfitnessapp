/**
 * Fase 2 — Ilustrações Everkinetic (estilo único, domínio público).
 * Composição: frame inicial (relaxation) + seta + frame contraído (tension),
 * lado a lado em 400x400 branco → WebP q70 → pronto pro Storage.
 *
 * Uso: node scripts/everkinetic-compose.mjs [slug1 slug2 ...]   (sem args = todos)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "scripts/everkinetic-out";
mkdirSync(OUT, { recursive: true });
const RAW = "https://raw.githubusercontent.com/everkinetic/data/main/dist/svg";
const UA = { "User-Agent": "GymFitnessApp/1.0 (contact: dev@stackgym.fit)" };

/** slug da lib → id_num Everkinetic (curadoria manual, revisada) */
export const EVK_MAP = {
  // Peito
  "supino-reto": "0042", "supino-inclinado": "0043", "supino-declinado": "0051",
  "supino-com-halteres": "0055", "crucifixo-com-halteres": "0056", "crucifixo-polia": "0048",
  "voador-peck-deck": "0057", "flexao-de-braco": "0077", "fundos-paralelas": "0054",
  // Costas
  "puxada-alta": "0096", "puxada-alta-fechada": "0096", "pulldown-supinado": "0095",
  "puxada-triangulo": "0093", "barra-fixa": "0087", "barra-fixa-pronada": "0087",
  "barra-fixa-supinada": "0087", "remada-curvada": "0026", "remada-unilateral": "0024", "remada-cavalinho": "0029", "remada-baixa": "0025",
  "remada-na-polia": "0025", "shrugg": "0030",
  // Ombro
  "desenvolvimento-militar": "0004", "desenvolvimento-com-halteres": "0031", "desenvolvimento-na-maquina": "0078",
  "desenvolvimento-arnold": "0038", "elevacao-lateral": "0018", "elevacao-frontal": "0033", "elevacao-lateral-polia": "0017",
  // Bíceps
  "rosca-direta": "0211", "rosca-alternada": "0223", "rosca-scott": "0239",
  "rosca-concentrada": "0220", "rosca-martelo": "0213", "rosca-na-polia-baixa": "0212",
  "rosca-inversa": "0257", "rosca-21": "0211",
  // Tríceps
  "triceps-pulley": "0205", "triceps-testa": "0179", "triceps-corda": "0206",
  "triceps-frances": "0193", "triceps-maquina": "0210", "mergulho-paralelas": "0172",
  // Pernas
  "agachamento-smith": "0124", "agachamento-livre": "0122", "agachamento-frontal": "0138",
  "agachamento-sumo": "0152", "agachamento-bulgaro": "0132", "leg-press-45": "0127", "leg-press-pes-altos": "0127",
  "leg-press-unilateral": "0127", "cadeira-extensora": "0142", "extensao-tradicional": "0142",
  "afundo": "0114", "mesa-flexora": "0117", "cadeira-flexora": "0119", "stiff": "0118",
  "bom-dia": "0101", "hiperextensao-lombar": "0103", "cadeira-abdutora": "0156",
  "elevacao-pelvica": "0109", "hip-thrust": "0109", "passada": "0121", "kickback": "0112",
  "panturrilha-em-pe": "0281", "panturrilha-no-leg-press": "0273", "panturrilha-sentado": "0272",
  // Abdômen
  "crunch-solo": "0291", "crunch-polia-alta": "0288", "prancha-lateral": "0113",
  "elevacao-de-perna-infra": "0021",
};

const SETA = Buffer.from(
  `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><path d="M8 32 H44 M34 16 L50 32 L34 48" stroke="#F4711E" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
);

/** índice nome→arquivos do exercises.json (cache) */
let EVK_INDEX = null;
async function evkIndex() {
  if (EVK_INDEX) return EVK_INDEX;
  const res = await fetch("https://raw.githubusercontent.com/everkinetic/data/main/exercises.json", { headers: UA });
  const all = await res.json();
  EVK_INDEX = {};
  for (const ex of all) {
    const files = (ex.img ?? []).map((p) => String(p).replace("_images/web/", "").replace("_images/", ""));
    if (files.length) EVK_INDEX[ex.id_num] = { files, name: ex.name };
  }
  return EVK_INDEX;
}

async function fetchFrame(idNum, idx /* 0=relaxation, 1=tension */) {
  const cacheSvg = `${OUT}/_cache_${idNum}-${idx === 0 ? "relaxation" : "tension"}.svg`;
  if (existsSync(cacheSvg)) return readFileSync(cacheSvg);
  // 1ª tentativa: SVG por padrão de nome
  const kind = idx === 0 ? "relaxation" : "tension";
  let res = await fetch(`${RAW}/${idNum}-${kind}.svg`, { headers: UA });
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(cacheSvg, buf);
    return buf;
  }
  // 2ª tentativa: PNG por nome (campo img do exercises.json)
  const idxData = await evkIndex();
  const entry = idxData[idNum];
  if (entry?.files?.[idx]) {
    const pngUrl = `https://raw.githubusercontent.com/everkinetic/data/main/_images/web/${entry.files[idx]}`;
    res = await fetch(pngUrl, { headers: UA });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(`${OUT}/_cache_${idNum}-${idx}.png`, buf);
      return buf;
    }
  }
  throw new Error(`sem frames para ${idNum}`);
}

async function framePng(svgBuf, size = 184) {
  // trim corta a margem transparente do viewBox → boneco preenche o frame
  return sharp(svgBuf, { density: 260 })
    .trim({ threshold: 12 })
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

async function compose(slug, idNum) {
  const [relax, tense] = await Promise.all([fetchFrame(idNum, 0), fetchFrame(idNum, 1)]);
  const [pngA, pngB, seta] = await Promise.all([
    framePng(relax), framePng(tense),
    sharp(SETA, { density: 150 }).resize(56, 56).png().toBuffer(),
  ]);
  await sharp({
    create: { width: 400, height: 400, channels: 4, background: "#ffffff" },
  })
    .composite([
      { input: pngA, top: 108, left: 14 },
      { input: seta, top: 172, left: 172 },
      { input: pngB, top: 108, left: 202 },
    ])
    .webp({ quality: 70 })
    .toFile(`${OUT}/${slug}.webp`);
}

const args = process.argv.slice(2);
const targets = args.length ? args : Object.keys(EVK_MAP);
const done = [];
for (const slug of targets) {
  const id = EVK_MAP[slug];
  if (!id) {
    console.log(`${slug}: sem match — ignorado`);
    continue;
  }
  try {
    await compose(slug, id);
    done.push(slug);
    console.log(`${slug} ✓ (${id})`);
  } catch (e) {
    console.log(`${slug} ✗ ${String(e).slice(0, 70)}`);
  }
}
console.log(`\n${done.length}/${targets.length} compostos`);
