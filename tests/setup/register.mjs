// Deixa o node:test importar o código do app como o Next importa:
// "~/x" → src/x, e imports sem extensão → .ts/.tsx/index.ts.
import { register } from "node:module";
register("./resolve-hooks.mjs", import.meta.url);
await import("./browser-env.mjs");
