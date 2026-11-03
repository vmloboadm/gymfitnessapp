import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const EXTS = [".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

function withExt(path) {
  if (existsSync(path) && statSync(path).isFile()) return path;
  for (const ext of EXTS) if (existsSync(path + ext)) return path + ext;
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("~/")) {
    const hit = withExt(SRC + specifier.slice(2));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    if (!existsSync(base) || statSync(base).isDirectory()) {
      const hit = withExt(base);
      if (hit) return next(pathToFileURL(hit).href, context);
    }
  }
  return next(specifier, context);
}
