/**
 * Bonequinhos da privacidade da foto (migration 094). Quando o aluno escolhe
 * "ícone", o servidor manda "icone:N" no lugar da foto. Aqui viram imagem SVG.
 * Laranja da marca no fundo, silhueta simples e um traço de cabelo por variante.
 */
const HAIR: Record<number, string> = {
  1: "M34 46 C34 26 86 26 86 46 C80 36 40 36 34 46 Z", // cabelo curto
  2: "M32 50 C28 24 92 24 88 50 C88 40 76 34 60 34 C44 34 32 40 32 50 Z", // cabelo com franja
  3: "M36 44 C36 28 84 28 84 44 C84 56 78 60 76 58 C72 44 48 44 44 58 C42 60 36 56 36 44 Z", // coque
};

const SKIN = "#FFD9B8";
const SHIRT = "#FFF8EA";

export function iconSvg(n: number): string {
  const k = n >= 1 && n <= 3 ? n : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4711E"/><stop offset="1" stop-color="#B8470B"/></linearGradient></defs>
  <rect width="120" height="120" fill="url(#g)"/>
  <path d="M22 120 C22 90 40 80 60 80 C80 80 98 90 98 120 Z" fill="${SHIRT}"/>
  <circle cx="60" cy="54" r="22" fill="${SKIN}"/>
  <path d="${HAIR[k]}" fill="#2B1A10"/>
  <circle cx="52" cy="56" r="2" fill="#2B1A10"/><circle cx="68" cy="56" r="2" fill="#2B1A10"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Converte "icone:N" em imagem; qualquer outro valor volta como veio. */
export function resolveAvatarSrc(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const m = /^icone:(\d)$/.exec(src);
  return m ? iconSvg(Number(m[1])) : src;
}
