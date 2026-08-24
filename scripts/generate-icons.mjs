// Script de pós-build: gera ícones PNG do PWA a partir do SVG da marca.
// Sem dependências externas (usa zlib do Node p/ PNG). Rodar:
//   node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");

// Cores da marca (blueprint §4.1)
const NAVY = [11, 20, 38, 255]; // #0B1426
const ORANGE = [242, 101, 34, 255]; // #F26522
const WHITE = [255, 255, 255, 255];

// Máscara: barras de halter do GymFitness logo
function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const rounded = Math.round(size * 0.22); // radius do quadrado

  const inCircle = (x, y, cx, cy, r) => {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // cantos arredondados → fora fica transparente
      const nearCorner =
        (x < rounded && y < rounded && !inCircle(x, y, rounded - 0.5, rounded - 0.5, rounded)) ||
        (x >= size - rounded && y < rounded && !inCircle(x, y, size - rounded + 0.5, rounded - 0.5, rounded)) ||
        (x < rounded && y >= size - rounded && !inCircle(x, y, rounded - 0.5, size - rounded + 0.5, rounded)) ||
        (x >= size - rounded && y >= size - rounded && !inCircle(x, y, size - rounded + 0.5, size - rounded + 0.5, rounded));
      if (nearCorner) {
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0;
        continue;
      }

      // fundo navy
      px[i] = NAVY[0]; px[i + 1] = NAVY[1]; px[i + 2] = NAVY[2]; px[i + 3] = 255;

      const g = (x + 0.5) / size; // 0..1
      const v = (y + 0.5) / size;

      // barra do halter (retângulo preenchido laranja)
      const barW = size * 0.5;
      const barH = size * 0.16;
      const barX = (size - barW) / 2;
      const barY = size * 0.42;
      const inBar =
        x >= barX && x < barX + barW && y >= barY && y < barY + barH;

      if (inBar) {
        px[i] = ORANGE[0]; px[i + 1] = ORANGE[1]; px[i + 2] = ORANGE[2];
        continue;
      }

      // pesos (barras pequenas verticais e horizontais)
      const w = size * 0.08;
      const near =
        (x >= size * 0.28 && x < size * 0.28 + w && y >= size * 0.25 && y < size * 0.75) ||
        (x >= size * 0.72 - w && x < size * 0.72 && y >= size * 0.25 && y < size * 0.75) ||
        (x >= size * 0.2 && x < size * 0.24 + w && y >= size * 0.6 && y < size * 0.65) ||
        (y >= size * 0.2 && y < size * 0.2 + w && x >= size * 0.32 && x < size * 0.68);

      if (near) {
        px[i] = WHITE[0]; px[i + 1] = WHITE[1]; px[i + 2] = WHITE[2];
        continue;
      }

      // gradiente sutil de profundidade (legibilidade)
      const shade = 1 - g * 0.18;
      px[i] = Math.min(255, Math.round(px[i] * shade));
      px[i + 1] = Math.min(255, Math.round(px[i + 1] * shade));
      px[i + 2] = Math.min(255, Math.round(px[i + 2] * shade));
      void v;
    }
  }
  return px;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, draw(size));
  writeFileSync(join(OUT, `icon-${size}x${size}.png`), png);
  console.log(`icon-${size}x${size}.png (${png.length} bytes)`);
}

console.log("Ícones PWA gerados em /public/icons");