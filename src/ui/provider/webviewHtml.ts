/**
 * @file Plantilla HTML del webview GhostPrompt (CSP nonce y URIs).
 */
import { existsSync, readFileSync } from 'node:fs';

import * as vscode from 'vscode';

/**
 * Nonce aleatorio para Content-Security-Policy del webview.
 * @returns {string} Un nonce aleatorio seguro para inyección de scripts.
 */
export function generateGhostPromptWebviewNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export type GhostPromptWebviewHtmlParameters = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  viewContributionId: string;
  capabilitiesPayload: Record<string, unknown>;
};

/**
 * Construye el HTML del webview a partir del bundle React generado por Vite,
 * reemplazando placeholders por URIs seguras y CSP.
 * @param {GhostPromptWebviewHtmlParameters} params - Parámetros de construcción del webview.
 * @returns {string} HTML final para cargar en el webview.
 * @throws {Error} Si falta el bundle React compilado en `src/ui/webview/dist/react/index.html`.
 */
export function buildGhostPromptWebviewHtml(params: GhostPromptWebviewHtmlParameters): string {
  const { extensionUri, webview, viewContributionId, capabilitiesPayload } = params;
  const nonce = generateGhostPromptWebviewNonce();
  const reactIndexHtmlPath = vscode.Uri.joinPath(
    extensionUri,
    'src',
    'ui',
    'webview',
    'dist',
    'react',
    'index.html',
  ).fsPath;

  if (!existsSync(reactIndexHtmlPath)) {
    throw new Error('GhostPrompt React webview bundle missing. Run `npm run build:webview`.');
  }

  const rawHtml = readFileSync(reactIndexHtmlPath, 'utf8');
  const reactAssetRoot = vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'webview', 'dist', 'react');
  const htmlWithAssets = rawHtml.replaceAll(
    /(src|href)="\.\/([^\s"]+)"/gu,
    (_match: string, attr: string, relativePath: string) => {
    const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(reactAssetRoot, relativePath));
      return `${attr}="${assetUri.toString()}"`;
    },
  );
  // Vite emite el <meta CSP> en varias líneas; si no coincide el reemplazo, VS Code deja
  // script-src 'unsafe-inline' y bloquea los bundles servidos vía asWebviewUri (vscode-cdn).
  const cspMetaPattern = /<meta\s[^>]*?http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gius;
  const htmlWithCsp = htmlWithAssets.replaceAll(
    cspMetaPattern,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src https:; img-src ${webview.cspSource} data: https:;" />`,
  );
  const scriptInjection = `  <script nonce="${nonce}">window.__ghostPromptViewId=${JSON.stringify(
    viewContributionId,
  )}; window.__ghostPromptCapabilities=${JSON.stringify(capabilitiesPayload)};</script>`;
  return htmlWithCsp.replace('</head>', `${scriptInjection}\n</head>`);
}
