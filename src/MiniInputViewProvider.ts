/**
 * @fileoverview WebviewViewProvider para el input de GhostPrompt.
 *
 * Registra la vista en el activity bar y el panel inferior (C2).
 * Protocolo host↔webview:
 *   - `suggest`    (webview → host): solicitar suggestion para el texto parcial.
 *   - `loading`    (host → webview): indicar que hay una suggestion en curso.
 *   - `suggestion` (host → webview): devolver el texto de la suggestion capturada.
 *   - `empty`      (host → webview): no hay suggestion disponible.
 *   - `error`      (host → webview): error al pedir suggestion.
 *   - `accept`     (webview → host): el usuario aceptó la suggestion con Tab.
 *   - `send`       (webview → host): enviar el prompt completo al chat de Copilot.
 *   - `clear`      (host → webview): resetear el input tras un envío exitoso.
 */
import * as fs from "fs";
import * as vscode from "vscode";
import { sendToChat } from "./ChatBridge";
import { append as appendLog } from "./ConversationLog";
import {
  requestCompletion,
  resolveSuggestionLanguage,
  SuggestionLanguageMode,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from "./CopilotCompletion";
import { isSuggestionDebugEnabled, logSuggestionDebug } from "./SuggestionDebug";
import { SuggestionRequestGovernor } from "./SuggestionRequestGovernor";
import { appendSuggestion } from "./SuggestionLog";

/** Formas de mensaje recibidas desde el webview. */
type WebviewMessage =
  | { type: "suggest"; text: string; captureId: number }
  | { type: "accept"; context: string; suggestion: string }
  | { type: "send"; text: string }
  | { type: "init" }
  | {
      type: "updateSetting";
      key:
        | "suggestionModelPolicy"
        | "suggestionStyle"
        | "contextMode"
        | "suggestionLanguageChoice"
        | "debugSuggestions";
      value: string | boolean;
    };

export class MiniInputViewProvider implements vscode.WebviewViewProvider {
  /** View ID for the activity bar container. */
  public static readonly viewId = "ghostPrompt.input";
  /** View ID for the bottom panel container. */
  public static readonly panelViewId = "ghostPrompt.inputPanel";

  private _latestCaptureId = 0;
  private _activeSuggestionRequest?: vscode.CancellationTokenSource;
  private _lastAcceptedSuggestion = "";
  private _lastSentPrompt = "";
  private readonly _recentSentPrompts: string[] = [];
  private _lastEffectiveSuggestionLanguage: SupportedSuggestionLanguage = "en";

  constructor(private readonly _context: vscode.ExtensionContext) {}

  private _getSuggestionModelPolicy(): SuggestionModelPolicy {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("suggestionModelPolicy", "nonPremiumOnly");
    return value === "anyModel" ? "anyModel" : "nonPremiumOnly";
  }

  private _getMaxSuggestionChars(): number {
    const rawValue = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<number>("maxSuggestionChars", 180);
    if (!Number.isFinite(rawValue)) {
      return 180;
    }
    return Math.max(40, Math.min(500, Math.floor(rawValue)));
  }

  private _getSuggestionStyle(): SuggestionStyle {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("suggestionStyle", "balanced");
    if (value === "concise" || value === "detailed") {
      return value;
    }
    return "balanced";
  }

  private _getContextMode(): "off" | "basic" | "project" {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("contextMode", "basic");
    if (value === "off" || value === "project") {
      return value;
    }
    return "basic";
  }

  private _getSuggestionLanguageMode(): SuggestionLanguageMode {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("suggestionLanguageMode", "auto");
    return value === "manual" ? "manual" : "auto";
  }

  private _getSuggestionLanguage(): SupportedSuggestionLanguage {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("suggestionLanguage", "en");
    return value === "es" ? "es" : "en";
  }

  private _getSuggestionLanguageChoice(): "auto" | SupportedSuggestionLanguage {
    const mode = this._getSuggestionLanguageMode();
    if (mode === "auto") {
      return "auto";
    }
    return this._getSuggestionLanguage();
  }

  private _collectProjectContext(): {
    workspaceName?: string;
    activeFilePath?: string;
    activeLanguageId?: string;
    activeSelection?: string;
  } {
    const editor = vscode.window.activeTextEditor;
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name;
    if (!editor) {
      return { workspaceName };
    }
    const activeLanguageId = editor.document.languageId;
    const activeFilePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const selected = editor.selection?.isEmpty
      ? ""
      : editor.document.getText(editor.selection);
    const activeSelection = selected ? this._trimContextField(selected, 320) : undefined;
    return {
      workspaceName,
      activeFilePath: this._trimContextField(activeFilePath, 180),
      activeLanguageId: this._trimContextField(activeLanguageId, 40),
      activeSelection,
    };
  }

  private _trimContextField(value: string, maxChars: number): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
  }

  private _postSettings(webview: vscode.Webview): void {
    webview.postMessage({
      type: "settings",
      settings: {
        suggestionModelPolicy: this._getSuggestionModelPolicy(),
        suggestionStyle: this._getSuggestionStyle(),
        contextMode: this._getContextMode(),
        suggestionLanguageChoice: this._getSuggestionLanguageChoice(),
        effectiveSuggestionLanguage: this._lastEffectiveSuggestionLanguage,
        debugSuggestions: isSuggestionDebugEnabled(),
      },
    });
  }

  private async _updateSetting(
    message: Extract<WebviewMessage, { type: "updateSetting" }>,
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration("ghostPrompt");
    if (message.key === "suggestionModelPolicy") {
      const value =
        message.value === "anyModel" ? "anyModel" : "nonPremiumOnly";
      await config.update(
        "suggestionModelPolicy",
        value,
        vscode.ConfigurationTarget.Global,
      );
      return;
    }
    if (message.key === "suggestionStyle") {
      const value =
        message.value === "concise" || message.value === "detailed"
          ? message.value
          : "balanced";
      await config.update(
        "suggestionStyle",
        value,
        vscode.ConfigurationTarget.Global,
      );
      return;
    }
    if (message.key === "contextMode") {
      const value =
        message.value === "off" || message.value === "project"
          ? message.value
          : "basic";
      await config.update("contextMode", value, vscode.ConfigurationTarget.Global);
      return;
    }
    if (message.key === "suggestionLanguageChoice") {
      const choice =
        message.value === "auto" || message.value === "es" || message.value === "en"
          ? message.value
          : "auto";
      if (choice === "auto") {
        await config.update(
          "suggestionLanguageMode",
          "auto",
          vscode.ConfigurationTarget.Global,
        );
      } else {
        await config.update(
          "suggestionLanguageMode",
          "manual",
          vscode.ConfigurationTarget.Global,
        );
        await config.update(
          "suggestionLanguage",
          choice,
          vscode.ConfigurationTarget.Global,
        );
        this._lastEffectiveSuggestionLanguage = choice;
      }
      return;
    }
    if (message.key === "debugSuggestions") {
      await config.update(
        "debugSuggestions",
        Boolean(message.value),
        vscode.ConfigurationTarget.Global,
      );
    }
  }

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
      if (message.type === "init") {
        this._postSettings(webviewView.webview);
      } else if (message.type === "updateSetting") {
        await this._updateSetting(message);
        this._postSettings(webviewView.webview);
      } else if (message.type === "suggest") {
        const { text, captureId } = message;
        if (!text) {
          return;
        }
        const governor = SuggestionRequestGovernor.shared;
        const governorConfig = SuggestionRequestGovernor.fromWorkspace();
        const decision = governor.decide(text, governorConfig);
        const usage = governor.getUsageSnapshot(governorConfig);

        if (decision.kind === "serve-cache") {
          logSuggestionDebug(
            captureId,
            "request-cache-hit",
            `metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
          );
          if (decision.result.kind === "suggestion") {
            webviewView.webview.postMessage({
              type: "suggestion",
              suggestion: decision.result.suggestion,
              captureId,
            });
          } else if (decision.result.kind === "empty") {
            webviewView.webview.postMessage({
              type: "empty",
              reason: decision.result.reason,
              captureId,
            });
          } else {
            webviewView.webview.postMessage({
              type: "error",
              message: decision.result.message,
              captureId,
            });
          }
          return;
        }

        if (decision.kind === "block") {
          logSuggestionDebug(
            captureId,
            "request-blocked",
            `reason=${decision.reason} metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
          );
          webviewView.webview.postMessage({
            type: "empty",
            reason: decision.reason,
            captureId,
          });
          return;
        }

        this._latestCaptureId = captureId;
        logSuggestionDebug(
          captureId,
          "request-start",
          `chars=${text.length} policy=${this._getSuggestionModelPolicy()} style=${this._getSuggestionStyle()} metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
        );
        this._activeSuggestionRequest?.cancel();
        this._activeSuggestionRequest?.dispose();

        const tokenSource = new vscode.CancellationTokenSource();
        this._activeSuggestionRequest = tokenSource;

        webviewView.webview.postMessage({ type: "loading", captureId });

        try {
          const contextMode = this._getContextMode();
          const languageMode = this._getSuggestionLanguageMode();
          const effectiveLanguage = resolveSuggestionLanguage(
            languageMode,
            this._getSuggestionLanguage(),
            text,
          );
          this._lastEffectiveSuggestionLanguage = effectiveLanguage;
          webviewView.webview.postMessage({
            type: "languageEffective",
            language: effectiveLanguage,
          });
          const projectContext =
            contextMode === "project" ? this._collectProjectContext() : {};
          const result = await requestCompletion(text, {
            token: tokenSource.token,
            policy: this._getSuggestionModelPolicy(),
            maxSuggestionChars: this._getMaxSuggestionChars(),
            style: this._getSuggestionStyle(),
            context: {
              lastAcceptedSuggestion:
                contextMode === "off" ? undefined : this._lastAcceptedSuggestion,
              lastSentPrompt:
                contextMode === "off" ? undefined : this._lastSentPrompt,
              recentSentPrompts:
                contextMode === "off"
                  ? undefined
                  : this._recentSentPrompts.slice(0, 3),
              outputLanguage: effectiveLanguage,
              ...projectContext,
            },
          });
          governor.saveResult(decision.key, result, governorConfig);
          if (
            tokenSource.token.isCancellationRequested ||
            captureId !== this._latestCaptureId
          ) {
            logSuggestionDebug(captureId, "request-discarded", "stale-or-cancel");
            return;
          }

          if (result.kind === "suggestion") {
            logSuggestionDebug(
              captureId,
              "request-success",
              `suggestionChars=${result.suggestion.length} usage=${JSON.stringify(governor.getUsageSnapshot(governorConfig))}`,
            );
            webviewView.webview.postMessage({
              type: "suggestion",
              suggestion: result.suggestion,
              captureId,
            });
          } else if (result.kind === "empty") {
            logSuggestionDebug(captureId, "request-empty", `reason=${result.reason}`);
            webviewView.webview.postMessage({
              type: "empty",
              reason: result.reason,
              captureId,
            });
          } else {
            logSuggestionDebug(captureId, "request-error", result.message);
            webviewView.webview.postMessage({
              type: "error",
              message: result.message,
              captureId,
            });
          }
        } catch {
          // Request cancelada por una pulsación más reciente.
          logSuggestionDebug(captureId, "request-cancelled");
        } finally {
          if (this._activeSuggestionRequest === tokenSource) {
            this._activeSuggestionRequest = undefined;
          }
          tokenSource.dispose();
        }
      } else if (message.type === "accept") {
        this._lastAcceptedSuggestion = message.suggestion;
        await appendSuggestion(dataUri, message.context, message.suggestion);
      } else if (message.type === "send" && message.text) {
        this._lastSentPrompt = message.text;
        this._recentSentPrompts.unshift(message.text);
        if (this._recentSentPrompts.length > 5) {
          this._recentSentPrompts.length = 5;
        }
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
