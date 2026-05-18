/**
 * @file Plantilla HTML del webview GhostPrompt (CSP nonce y URIs).
 */
import { existsSync, readFileSync } from 'node:fs';

import * as vscode from 'vscode';

import { getLogger } from '../../system/log';

import {
  ensureScriptNonces,
  extractWebviewStylesheetRelativePath,
  inlineWebviewStylesheets,
  moveExternalScriptsToBodyEnd,
  rewriteGhostPromptWebviewAssetUrls,
  stripWebviewIncompatibleAttributes,
} from './webviewHtmlTransforms';

export {
  ensureScriptNonces,
  extractWebviewStylesheetRelativePath,
  inlineWebviewStylesheets,
  moveExternalScriptsToBodyEnd,
  rewriteGhostPromptWebviewAssetUrls,
  stripWebviewIncompatibleAttributes,
} from './webviewHtmlTransforms';

/**
 * Escapa texto para mostrarlo en HTML de error del webview.
 * @param {string} value - Texto sin escapar.
 * @returns {string} Texto seguro para insertar en HTML.
 */
function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * HTML mínimo cuando falla la carga del bundle React (visible en el panel, no pantalla negra).
 * @param {string} detail - Mensaje de error.
 * @returns {string} Documento HTML.
 */
export function buildGhostPromptWebviewFaultHtml(detail: string): string {
  const safe = escapeHtmlText(detail);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GhostPrompt</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 12px; }
    h2 { font-size: 13px; margin: 0 0 8px; }
    pre { white-space: pre-wrap; font-size: 12px; opacity: 0.9; }
  </style>
</head>
<body>
  <h2>GhostPrompt no pudo cargar la interfaz</h2>
  <pre>${safe}</pre>
  <p>Abre el panel de salida <strong>GhostPrompt Log</strong> para más detalle.</p>
</body>
</html>`;
}

/**
 * Nonce aleatorio para Content-Security-Policy del webview.
 * @returns {string} Un nonce aleatorio seguro para inyección de scripts.
 */
const EXTERNAL_SCRIPT_IN_BODY_PATTERN = /<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/giu;

/**
 *
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
    const detail =
      'GhostPrompt React webview bundle missing at src/ui/webview/dist/react/index.html. Run `npm run build:webview` (F5 dev) or reinstall the VSIX built with `npm run vsix`.';
    getLogger('ui').error('webview-bundle-missing', { path: reactIndexHtmlPath });
    throw new Error(detail);
  }

  const rawHtml = readFileSync(reactIndexHtmlPath, 'utf8');
  const reactAssetRoot = vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'webview', 'dist', 'react');
  const strippedHtml = stripWebviewIncompatibleAttributes(rawHtml);
  const stylesheetRelativePath = extractWebviewStylesheetRelativePath(strippedHtml);
  let cssInlinedBytes = 0;
  let htmlWithStyles = strippedHtml;
  if (stylesheetRelativePath) {
    const cssPath = vscode.Uri.joinPath(reactAssetRoot, stylesheetRelativePath).fsPath;
    if (existsSync(cssPath)) {
      const cssContent = readFileSync(cssPath, 'utf8');
      cssInlinedBytes = cssContent.length;
      htmlWithStyles = inlineWebviewStylesheets(strippedHtml, [cssContent], nonce);
    } else {
      getLogger('ui').error('webview-stylesheet-missing', { path: cssPath });
    }
  }
  const htmlWithAssets = rewriteGhostPromptWebviewAssetUrls(htmlWithStyles, (relativePath) =>
    webview.asWebviewUri(vscode.Uri.joinPath(reactAssetRoot, relativePath)).toString(),
  );

  const cspMetaPattern = /<\s*meta\s+http-equiv\s*=\s*["']content-security-policy["'][^>]*>/giu;
  const htmlWithCsp = htmlWithAssets.replaceAll(
    cspMetaPattern,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https:; img-src ${webview.cspSource} data: https:;" />`,
  );
  const scriptInjection = `  <script nonce="${nonce}">window.__ghostPromptViewId=${JSON.stringify(
    viewContributionId,
  )}; window.__ghostPromptCapabilities=${JSON.stringify(capabilitiesPayload)};</script>`;
  const bootStyles = `  <style nonce="${nonce}">
    html, body { margin: 0; min-height: 100%; background: var(--vscode-sideBar-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); font-family: var(--vscode-font-family, sans-serif); }
    #root { min-height: 120px; color: var(--vscode-foreground, #cccccc); }
    #gp-boot { margin: 0; padding: 0; opacity: 0.85; color: var(--vscode-foreground, #cccccc); }
    #root button, #root textarea, #root select { color: var(--vscode-foreground, #cccccc); }
    #root textarea { background: var(--vscode-input-background, #3c3c3c); border: 1px solid var(--vscode-input-border, #3c3c3c); }
    #root button { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #ffffff); }
  </style>`;
  const bootDiagnostics = `  <script nonce="${nonce}">
    (function () {
      window.addEventListener('error', function (ev) {
        console.error('[GhostPrompt webview]', ev.message, ev.filename, ev.lineno);
      });
      window.addEventListener('unhandledrejection', function (ev) {
        console.error('[GhostPrompt webview] unhandled rejection', ev.reason);
      });
    })();
  </script>`;
  const htmlWithInjection = htmlWithCsp.replace(
    '</head>',
    `${bootStyles}\n${bootDiagnostics}\n${scriptInjection}\n</head>`,
  );
  const finalHtml = moveExternalScriptsToBodyEnd(ensureScriptNonces(htmlWithInjection, nonce));
  const scriptSourceMatch = /<script\b[^>]*\bsrc=["']([^"']+)["']/iu.exec(finalHtml);
  const hasExternalStylesheetLink = /<link\b[^>]*\brel=["']stylesheet["']/iu.test(finalHtml);
  const bodyIndex = finalHtml.indexOf('<body');
  const bodyCloseIndex = finalHtml.indexOf('</body>');
  const bodySlice =
    bodyIndex !== -1 && bodyCloseIndex > bodyIndex ? finalHtml.slice(bodyIndex, bodyCloseIndex) : '';
  const bundleScriptsInBody = (bodySlice.match(EXTERNAL_SCRIPT_IN_BODY_PATTERN) ?? []).length;

  getLogger('ui').info('webview-html-built', {
    viewContributionId,
    bundlePath: reactIndexHtmlPath,
    hasModuleScript: finalHtml.includes('type="module"'),
    hasCrossOrigin: /\bcrossorigin\b/iu.test(finalHtml),
    scriptCount: (finalHtml.match(/<script\b/giu) ?? []).length,
    bundleScriptsInBody,
    hasRootDiv: bodySlice.includes('id="root"'),
    hasBootPlaceholder: bodySlice.includes('gp-boot'),
    scriptSrc: scriptSourceMatch?.[1] ?? '',
    cssInlinedBytes,
    hasExternalStylesheetLink,
  });

  return finalHtml;
}
