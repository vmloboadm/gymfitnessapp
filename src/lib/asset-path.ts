/**
 * Prefixa paths de assets públicos com o basePath do deploy (/app).
 * next/image já aplica basePath sozinho; <img> cru e CSS não — use aqui.
 * URLs externas (http/https/data) passam intactas.
 */
export function assetPath(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (!path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}
