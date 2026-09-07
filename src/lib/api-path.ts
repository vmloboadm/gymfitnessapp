/**
 * Helper para chamadas de API no cliente: adiciona o basePath configurado
 * (NEXT_PUBLIC_BASE_PATH, ex.: "/app" no Vercel). fetch() não aplica o
 * basePath do next.config automaticamente, então toda chamada manual de
 * /api/* precisa passar por aqui.
 */
export function apiPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}
