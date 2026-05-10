/**
 * Smoke check: existe `webview/dist/main.js` y contiene la firma esperada del cliente webview.
 * Ejecutar desde la raíz del repo (`npm run verify:webview-bundle`).
 *
 * Compila a `out/build/` — excluido del VSIX (`.vscodeignore`): solo herramienta de desarrollo/CI,
 * no forma parte del runtime de la extensión instalada.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const bundlePath = path.join(root, "webview", "dist", "main.js");

if (!fs.existsSync(bundlePath)) {
  console.error(
    "[GhostPrompt] Falta webview/dist/main.js — ejecuta npm run build:webview",
  );
  process.exit(1);
}

const body = fs.readFileSync(bundlePath, "utf8");
if (!body.includes("acquireVsCodeApi")) {
  console.error(
    "[GhostPrompt] Bundle webview sin firma esperada (acquireVsCodeApi).",
  );
  process.exit(1);
}

console.log(
  `[GhostPrompt] Webview bundle OK (${bundlePath}, ${body.length} bytes)`,
);
