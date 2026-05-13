/**
 * Plantilla HTML del webview GhostPrompt (CSP nonce y URIs).
 */
import * as fs from "fs";
import * as vscode from "vscode";

/**
 * Nonce aleatorio para Content-Security-Policy del webview.
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
export function buildGhostPromptWebviewHtml(
  params: GhostPromptWebviewHtmlParams,
): string {
  const { extensionUri, webview, viewContributionId, capabilitiesPayload } =
    params;
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "ui", "webview", "dist", "main.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "ui", "webview", "style.css"),
  );
  const nonce = generateGhostPromptWebviewNonce();

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
