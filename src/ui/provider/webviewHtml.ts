/**
 * Plantilla HTML del webview GhostPrompt (CSP nonce y URIs).
 */
import * as fs from "fs";
import * as vscode from "vscode";

/**
 * Nonce aleatorio para Content-Security-Policy del webview.
 *
 * @returns Un nonce aleatorio seguro para inyección de scripts.
 */
export function generateGhostPromptWebviewNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 32 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export type GhostPromptWebviewHtmlParams = {
  extensionUri: vscode.Uri;
  webview: vscode.Webview;
  viewContributionId: string;
  capabilitiesPayload: Record<string, unknown>;
};

/**
 * Construye el HTML del webview a partir del bundle React generado por Vite,
 * reemplazando placeholders por URIs seguras y CSP.
 *
 * @param params Parámetros de construcción del webview.
 * @returns HTML final para cargar en el webview.
 * @throws Si falta el bundle React compilado en `src/ui/webview/dist/react/index.html`.
 */
export function buildGhostPromptWebviewHtml(
  params: GhostPromptWebviewHtmlParams,
): string {
  const { extensionUri, webview, viewContributionId, capabilitiesPayload } =
    params;
  const nonce = generateGhostPromptWebviewNonce();
  const reactIndexHtmlPath = vscode.Uri.joinPath(
    extensionUri,
    "src",
    "ui",
    "webview",
    "dist",
    "react",
    "index.html",
  ).fsPath;

  if (!fs.existsSync(reactIndexHtmlPath)) {
    throw new Error(
      "GhostPrompt React webview bundle missing. Run `npm run build:webview`.",
    );
  }

  const rawHtml = fs.readFileSync(reactIndexHtmlPath, "utf-8");
  const reactAssetRoot = vscode.Uri.joinPath(
    extensionUri,
    "src",
    "ui",
    "webview",
    "dist",
    "react",
  );
  const htmlWithAssets = rawHtml.replace(
    /(src|href)="\.\/([^"\s]+)"/g,
    (_, attr, relativePath) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(reactAssetRoot, relativePath),
      );
      return `${attr}="${assetUri.toString()}"`;
    },
  );
  const htmlWithCsp = htmlWithAssets.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource};" />`,
  );
  const scriptInjection = `  <script nonce="${nonce}">window.__ghostPromptViewId=${JSON.stringify(
    viewContributionId,
  )}; window.__ghostPromptCapabilities=${JSON.stringify(
    capabilitiesPayload,
  )};</script>`;
  return htmlWithCsp.replace("</head>", `${scriptInjection}\n</head>`);
}
