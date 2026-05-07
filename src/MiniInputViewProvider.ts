/**
 * @fileoverview WebviewViewProvider para el input de GhostPrompt.
 *
 * Registra la vista en el activity bar y el panel inferior (C2).
 * Protocolo host↔webview:
 *   - `suggest`    (webview → host): solicitar suggestion para el texto parcial.
 *   - `suggestion` (host → webview): devolver el texto de la suggestion capturada.
 *   - `accept`     (webview → host): el usuario aceptó la suggestion con Tab.
 *   - `send`       (webview → host): enviar el prompt completo al chat de Copilot.
 *   - `clear`      (host → webview): resetear el input tras un envío exitoso.
 */
import * as fs from "fs";
import * as vscode from "vscode";
import { sendToChat } from "./ChatBridge";
import { append as appendLog } from "./ConversationLog";
import { requestCompletion } from "./CopilotCompletion";
import { appendSuggestion } from "./SuggestionLog";

/** Formas de mensaje recibidas desde el webview. */
type WebviewMessage =
  | { type: "suggest"; text: string; captureId: number }
  | { type: "accept"; context: string; suggestion: string }
  | { type: "send"; text: string };

export class MiniInputViewProvider implements vscode.WebviewViewProvider {
  /** View ID for the activity bar container. */
  public static readonly viewId = "ghostPrompt.input";
  /** View ID for the bottom panel container. */
  public static readonly panelViewId = "ghostPrompt.inputPanel";

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const { extensionUri, storageUri, globalStorageUri } = this._context;
    // storageUri requiere workspace abierto; globalStorageUri siempre existe.
    const dataUri = storageUri ?? globalStorageUri;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === "suggest") {
        const { text, captureId } = message;
        if (!text) {
          return;
        }
        const suggestion = await requestCompletion(text);
        if (suggestion) {
          webviewView.webview.postMessage({
            type: "suggestion",
            suggestion,
            captureId,
          });
        }
      } else if (message.type === "accept") {
        await appendSuggestion(dataUri, message.context, message.suggestion);
      } else if (message.type === "send" && message.text) {
        await appendLog(dataUri, message.text);
        await sendToChat(message.text);
        webviewView.webview.postMessage({ type: "clear" });
      }
    });
  }

  /**
   * Loads `webview/index.html` and injects secure asset URIs and the CSP nonce.
   *
   * @param webview - The webview instance to generate HTML for.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const { extensionUri } = this._context;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "main.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "style.css"),
    );
    const nonce = generateNonce();

    const templatePath = vscode.Uri.joinPath(
      extensionUri,
      "webview",
      "index.html",
    ).fsPath;

    return fs
      .readFileSync(templatePath, "utf-8")
      .replaceAll("{{nonce}}", nonce)
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{styleUri}}", styleUri.toString())
      .replaceAll("{{scriptUri}}", scriptUri.toString());
  }
}

/**
 * Generates a random 32-character nonce string for the Content Security Policy.
 * @returns A random alphanumeric string of length 32.
 */
function generateNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 32 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
