/**
 * @file Smoke check de bundle webview React generado.
 *
 * Comprueba que el build de webview existe y contiene la firma esperada.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Escribe en stderr y aborta el script con código de salida distinto de cero.
 * @param {string} message - Mensaje de error (se añade salto de línea si falta).
 * @throws {Error} Siempre aborta el script de verificación.
 * @returns {never} No retorna.
 */
function fail(message: string): never {
  const line = message.endsWith('\n') ? message : `${message}\n`;
  process.stderr.write(line);
  throw new Error(line.trim());
}

const root = process.cwd();
const reactBuildRoot = join(root, 'src', 'ui', 'webview', 'dist', 'react');
const indexHtmlPath = join(reactBuildRoot, 'index.html');

if (!existsSync(indexHtmlPath)) {
  fail('[GhostPrompt] Falta src/ui/webview/dist/react/index.html — ejecuta npm run build:webview');
}

const html = readFileSync(indexHtmlPath, 'utf8');
const scriptMatch = /<script[^>]+src="(?<src>[^"]+)"[^>]*>/u.exec(html);
if (!scriptMatch?.groups?.src) {
  fail('[GhostPrompt] No se encontró un script válido en src/ui/webview/dist/react/index.html.');
}

const scriptPath = join(reactBuildRoot, scriptMatch.groups.src.replace(/^\.\//u, ''));
if (!existsSync(scriptPath)) {
  fail(`[GhostPrompt] No se encontró el asset de script compilado: ${scriptPath}`);
}

const body = readFileSync(scriptPath, 'utf8');
if (!body.includes('acquireVsCodeApi')) {
  fail('[GhostPrompt] Bundle React webview sin firma esperada (acquireVsCodeApi).');
}

process.stdout.write(`[GhostPrompt] Webview bundle OK (${scriptPath}, ${body.length} bytes)\n`);
