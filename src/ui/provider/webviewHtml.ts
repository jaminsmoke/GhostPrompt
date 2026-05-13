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
 * Lee `src/ui/webview/index.html` y sustituye placeholders por URIs seguras y nonce.
 */
/**
 * Construye el HTML del webview reemplazando placeholders por URIs seguras y CSP.
 *
 * @param params Parámetros de construcción del webview.
 * @returns HTML final para cargar en el webview.
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

  if (fs.existsSync(reactIndexHtmlPath)) {
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

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "ui", "webview", "dist", "main.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "ui", "webview", "style.css"),
  );
  const templatePath = vscode.Uri.joinPath(
    extensionUri,
    "src",
    "ui",
    "webview",
    "index.html",
  ).fsPath;

  return fs
    .readFileSync(templatePath, "utf-8")
    .replaceAll("{{nonce}}", nonce)
    .replaceAll("{{cspSource}}", webview.cspSource)
    .replaceAll("{{styleUri}}", styleUri.toString())
    .replaceAll("{{scriptUri}}", scriptUri.toString())
    .replaceAll("{{viewIdScript}}", JSON.stringify(viewContributionId))
    .replaceAll(
      "{{capabilitiesScript}}",
      JSON.stringify(capabilitiesPayload),
    );
}
