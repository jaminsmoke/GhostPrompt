/**
 * @file Smoke check de bundle webview React generado.
 *
 * Comprueba que el build de webview existe y contiene la firma esperada.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reactBuildRoot = join(root, 'src', 'ui', 'webview', 'dist', 'react');
const indexHtmlPath = join(reactBuildRoot, 'index.html');

if (!existsSync(indexHtmlPath)) {
  process.stderr.write(
    '[GhostPrompt] Falta src/ui/webview/dist/react/index.html — ejecuta npm run build:webview\n',
  );
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, 'utf8');
const scriptMatch = /<script[^>]+src="(?<src>[^"]+)"[^>]*>/u.exec(html);
if (!scriptMatch?.groups?.src) {
  process.stderr.write(
    '[GhostPrompt] No se encontró un script válido en src/ui/webview/dist/react/index.html.\n',
  );
  process.exit(1);
}

const scriptPath = join(reactBuildRoot, scriptMatch.groups.src.replace(/^\.\//u, ''));
if (!existsSync(scriptPath)) {
  process.stderr.write(`[GhostPrompt] No se encontró el asset de script compilado: ${scriptPath}\n`);
  process.exit(1);
}

const body = readFileSync(scriptPath, 'utf8');
if (!body.includes('acquireVsCodeApi')) {
  process.stderr.write('[GhostPrompt] Bundle React webview sin firma esperada (acquireVsCodeApi).\n');
  process.exit(1);
}

process.stdout.write(`[GhostPrompt] Webview bundle OK (${scriptPath}, ${body.length} bytes)\n`);
