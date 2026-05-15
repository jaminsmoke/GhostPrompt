/**
 * @file Smoke check de bundle webview React generado.
 *
 * Comprueba que el build de webview existe y contiene la firma esperada.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const reactBuildRoot = path.join(root, 'src', 'ui', 'webview', 'dist', 'react');
const indexHtmlPath = path.join(reactBuildRoot, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error(
    '[GhostPrompt] Falta src/ui/webview/dist/react/index.html — ejecuta npm run build:webview',
  );
  process.exit(1);
}

const html = fs.readFileSync(indexHtmlPath, 'utf8');
const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*>/);
if (!scriptMatch) {
  console.error(
    '[GhostPrompt] No se encontró un script válido en src/ui/webview/dist/react/index.html.',
  );
  process.exit(1);
}

const scriptPath = path.join(reactBuildRoot, scriptMatch[1].replace(/^\.\//, ''));
if (!fs.existsSync(scriptPath)) {
  console.error(`[GhostPrompt] No se encontró el asset de script compilado: ${scriptPath}`);
  process.exit(1);
}

const body = fs.readFileSync(scriptPath, 'utf8');
if (!body.includes('acquireVsCodeApi')) {
  console.error('[GhostPrompt] Bundle React webview sin firma esperada (acquireVsCodeApi).');
  process.exit(1);
}

console.log(`[GhostPrompt] Webview bundle OK (${scriptPath}, ${body.length} bytes)`);
