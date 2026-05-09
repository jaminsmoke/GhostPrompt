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
 *   - `draftChanged` (webview → host): texto del borrador para sincronizar vistas.
 *   - `draftSync` / `draftHydrate` (host → webview): aplicar borrador remoto o estado inicial.
 *   - Mensajes de suggestion pueden llevar `broadcast: true` para espejar Sidebar + Panel.
 */
import * as fs from "fs";
import * as vscode from "vscode";
import { sendToChat } from "../bridge/ChatBridge";
import { append as appendLog } from "../log/ConversationLog";
import {
  getActiveCompletionProvider,
  listSuggestionModels,
  resolveSuggestionLanguage,
  SuggestionLanguageMode,
  SuggestionModelDescriptor,
  SuggestionModelPolicy,
  SuggestionStyle,
  SupportedSuggestionLanguage,
} from "../completion";
import { isSuggestionDebugEnabled, logSuggestionDebug } from "../debug/SuggestionDebug";
import { SuggestionRequestGovernor } from "../governor/SuggestionRequestGovernor";
import { appendSuggestion } from "../log/SuggestionLog";
import { ghostPromptSessionStore } from "../session/GhostPromptSessionStore";

/** Formas de mensaje recibidas desde el webview. */
type WebviewMessage =
  | { type: "suggest"; text: string; captureId: number }
  | { type: "draftChanged"; text: string; originViewId: string }
  | { type: "accept"; context: string; suggestion: string }
  | { type: "send"; text: string }
  | { type: "init" }
  | {
      type: "updateSetting";
      key:
        | "suggestionModelPolicy"
        | "selectedModelId"
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

  private static readonly _instances = new Set<MiniInputViewProvider>();

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    /** Identificador de contribución de la vista (`ghostPrompt.input` vs `ghostPrompt.inputPanel`). */
    public readonly viewContributionId: string,
  ) {
    MiniInputViewProvider._instances.add(this);
  }

  /**
   * Limpia el registro de instancias (solo tests; la extensión real mantiene 2 providers vivos).
   * @internal
   */
  public static clearWebviewRegistrationsForTests(): void {
    MiniInputViewProvider._instances.clear();
  }

  /** Emite a todas las vistas el mismo UI de suggestion/loading/idioma (`broadcast: true` en webview). */
  private static _broadcastUi(payload: Record<string, unknown>): void {
    const message = { ...payload, broadcast: true };
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(message);
    }
  }

  /** Propaga borrador a la otra vista GhostPrompt (Sidebar ↔ Panel). */
  private static _broadcastDraftSync(originViewId: string, text: string): void {
    for (const instance of MiniInputViewProvider._instances) {
      if (instance.viewContributionId === originViewId) {
        continue;
      }
      instance._view?.webview.postMessage({
        type: "draftSync",
        text,
        originViewId,
      });
    }
  }

  /** Vacía el composer en todas las vistas (p. ej. tras enviar al chat). */
  private static _broadcastClearAll(): void {
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage({ type: "clear" });
    }
  }

  private _getSuggestionModelPolicy(): SuggestionModelPolicy {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("suggestionModelPolicy", "nonPremiumOnly");
    return value === "anyModel" ? "anyModel" : "nonPremiumOnly";
  }

  private _getSelectedModelId(): string {
    const value = vscode.workspace
      .getConfiguration("ghostPrompt")
      .get<string>("selectedModelId", "auto");
    return value?.trim() || "auto";
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

  /**
   * Payload opcional para `window.__ghostPromptCapabilities` (webview).
   * Por defecto vacío: misma UX en Sidebar y Panel; reservado para flags futuros
   * (`compactToolbar`, etc.) sin romper paridad.
   */
  private _webviewCapabilitiesPayload(): Record<string, unknown> {
    return {};
  }

  private async _postSettings(webview: vscode.Webview): Promise<void> {
    const policy = this._getSuggestionModelPolicy();
    let availableModels: SuggestionModelDescriptor[] = [];
    try {
      availableModels = await listSuggestionModels(policy);
    } catch {
      availableModels = [];
    }
    webview.postMessage({
      type: "settings",
      settings: {
        suggestionModelPolicy: policy,
        selectedModelId: this._getSelectedModelId(),
        availableModels,
        suggestionStyle: this._getSuggestionStyle(),
        contextMode: this._getContextMode(),
        suggestionLanguageChoice: this._getSuggestionLanguageChoice(),
        effectiveSuggestionLanguage:
          ghostPromptSessionStore.getSnapshot().lastEffectiveSuggestionLanguage,
        effectiveModel: ghostPromptSessionStore.getSnapshot().lastEffectiveModel,
        debugSuggestions: isSuggestionDebugEnabled(),
      },
    });
  }

  private async _postSettingsIfReady(): Promise<void> {
    if (!this._view) {
      return;
    }
    await this._postSettings(this._view.webview);
  }

  private async _broadcastSettingsToAllViews(): Promise<void> {
    await Promise.all(
      Array.from(MiniInputViewProvider._instances, (instance) =>
        instance._postSettingsIfReady(),
      ),
    );
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
    if (message.key === "selectedModelId") {
      const value = typeof message.value === "string" ? message.value : "auto";
      await config.update("selectedModelId", value, vscode.ConfigurationTarget.Global);
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
        ghostPromptSessionStore.patchState({
          lastEffectiveSuggestionLanguage: choice,
        });
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
    this._view = webviewView;
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
        await this._postSettings(webviewView.webview);
        webviewView.webview.postMessage({
          type: "draftHydrate",
          text: ghostPromptSessionStore.getSnapshot().draftText,
        });
      } else if (message.type === "draftChanged") {
        if (
          typeof message.originViewId !== "string" ||
          message.originViewId !== this.viewContributionId
        ) {
          return;
        }
        const text = typeof message.text === "string" ? message.text : "";
        ghostPromptSessionStore.patchState({ draftText: text });
        MiniInputViewProvider._broadcastDraftSync(message.originViewId, text);
      } else if (message.type === "updateSetting") {
        await this._updateSetting(message);
        await this._broadcastSettingsToAllViews();
      } else if (message.type === "suggest") {
        const { text, captureId } = message;
        if (!text) {
          return;
        }
        const policy = this._getSuggestionModelPolicy();
        const selectedModelId = this._getSelectedModelId();
        const style = this._getSuggestionStyle();
        const contextMode = this._getContextMode();
        const languageMode = this._getSuggestionLanguageMode();
        const effectiveLanguage = resolveSuggestionLanguage(
          languageMode,
          this._getSuggestionLanguage(),
          text,
          ghostPromptSessionStore.getSnapshot().lastEffectiveSuggestionLanguage,
        );

        const governor = SuggestionRequestGovernor.shared;
        const governorConfig = SuggestionRequestGovernor.fromWorkspace();
        const decision = governor.decide(text, governorConfig, {
          language: effectiveLanguage,
          style,
          contextMode,
          modelPolicy: policy,
          selectedModelId,
        });
        const usage = governor.getUsageSnapshot(governorConfig);

        if (decision.kind === "serve-cache") {
          logSuggestionDebug(
            captureId,
            "request-cache-hit",
            `metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
          );
          if (decision.result.kind === "suggestion") {
            ghostPromptSessionStore.patchState({
              pendingSuggestion: decision.result.suggestion,
              suggestionFlowStatus: "success",
              ...(decision.result.model
                ? { lastEffectiveModel: decision.result.model }
                : {}),
            });
            MiniInputViewProvider._broadcastUi({
              type: "suggestion",
              suggestion: decision.result.suggestion,
              ...(decision.result.model ? { model: decision.result.model } : {}),
              captureId,
            });
          } else if (decision.result.kind === "empty") {
            ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
            MiniInputViewProvider._broadcastUi({
              type: "empty",
              reason: decision.result.reason,
              captureId,
            });
          } else {
            ghostPromptSessionStore.patchState({
              suggestionFlowStatus: "error",
              lastSuggestionError: decision.result.message,
            });
            MiniInputViewProvider._broadcastUi({
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
          ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
          MiniInputViewProvider._broadcastUi({
            type: "empty",
            reason: decision.reason,
            captureId,
          });
          return;
        }

        logSuggestionDebug(
          captureId,
          "request-start",
          `chars=${text.length} policy=${policy} selectedModelId=${selectedModelId} style=${style} lang=${effectiveLanguage} metrics=${JSON.stringify(governor.getMetrics())} usage=${JSON.stringify(usage)}`,
        );
        const tokenSource = ghostPromptSessionStore.prepareSuggestionRequest(captureId);

        MiniInputViewProvider._broadcastUi({ type: "loading", captureId });

        try {
          ghostPromptSessionStore.patchState({
            lastEffectiveSuggestionLanguage: effectiveLanguage,
          });
          MiniInputViewProvider._broadcastUi({
            type: "languageEffective",
            language: effectiveLanguage,
          });
          const projectContext =
            contextMode === "project" ? this._collectProjectContext() : {};
          const result = await getActiveCompletionProvider().requestCompletion(text, {
            token: tokenSource.token,
            policy,
            preferredModelId: selectedModelId === "auto" ? undefined : selectedModelId,
            maxSuggestionChars: this._getMaxSuggestionChars(),
            style,
            context: {
              lastAcceptedSuggestion:
                contextMode === "off"
                  ? undefined
                  : ghostPromptSessionStore.getSnapshot().lastAcceptedSuggestion,
              lastSentPrompt:
                contextMode === "off"
                  ? undefined
                  : ghostPromptSessionStore.getSnapshot().lastSentPrompt,
              recentSentPrompts:
                contextMode === "off"
                  ? undefined
                  : ghostPromptSessionStore.getSnapshot().recentSentPrompts.slice(0, 3),
              outputLanguage: effectiveLanguage,
              ...projectContext,
            },
          });
          governor.saveResult(decision.key, result, governorConfig);
          if (
            tokenSource.token.isCancellationRequested ||
            captureId !== ghostPromptSessionStore.getSnapshot().activeCaptureId
          ) {
            logSuggestionDebug(captureId, "request-discarded", "stale-or-cancel");
            return;
          }

          if (result.kind === "suggestion") {
            ghostPromptSessionStore.patchState({
              pendingSuggestion: result.suggestion,
              suggestionFlowStatus: "success",
              lastEffectiveModel: result.model,
            });
            logSuggestionDebug(
              captureId,
              "request-success",
              `suggestionChars=${result.suggestion.length} model=${result.model?.id ?? "unknown"} modelTier=${result.model?.tier ?? "unknown"} usage=${JSON.stringify(governor.getUsageSnapshot(governorConfig))}`,
            );
            MiniInputViewProvider._broadcastUi({
              type: "suggestion",
              suggestion: result.suggestion,
              ...(result.model ? { model: result.model } : {}),
              captureId,
            });
          } else if (result.kind === "empty") {
            ghostPromptSessionStore.patchState({ suggestionFlowStatus: "empty" });
            logSuggestionDebug(captureId, "request-empty", `reason=${result.reason}`);
            MiniInputViewProvider._broadcastUi({
              type: "empty",
              reason: result.reason,
              captureId,
            });
          } else {
            ghostPromptSessionStore.patchState({
              suggestionFlowStatus: "error",
              lastSuggestionError: result.message,
            });
            logSuggestionDebug(captureId, "request-error", result.message);
            MiniInputViewProvider._broadcastUi({
              type: "error",
              message: result.message,
              captureId,
            });
          }
        } catch {
          // Request cancelada por una pulsación más reciente.
          logSuggestionDebug(captureId, "request-cancelled");
        } finally {
          ghostPromptSessionStore.disposeActiveSuggestionToken(tokenSource);
          ghostPromptSessionStore.patchState({ suggestionFlowStatus: "idle" });
        }
      } else if (message.type === "accept") {
        ghostPromptSessionStore.patchState({
          lastAcceptedSuggestion: message.suggestion,
        });
        await appendSuggestion(dataUri, message.context, message.suggestion);
      } else if (message.type === "send" && message.text) {
        const recent = [
          message.text,
          ...ghostPromptSessionStore.getSnapshot().recentSentPrompts,
        ].slice(0, 5);
        ghostPromptSessionStore.patchState({
          lastSentPrompt: message.text,
          recentSentPrompts: recent,
          pendingSuggestion: "",
          draftText: "",
        });
        await appendLog(dataUri, message.text);
        await sendToChat(message.text);
        MiniInputViewProvider._broadcastClearAll();
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
      .replaceAll("{{scriptUri}}", scriptUri.toString())
      .replaceAll("{{viewIdScript}}", JSON.stringify(this.viewContributionId))
      .replaceAll(
        "{{capabilitiesScript}}",
        JSON.stringify(this._webviewCapabilitiesPayload()),
      );
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
