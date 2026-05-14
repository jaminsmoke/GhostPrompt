/**
 * @file WebviewViewProvider para el input de GhostPrompt.
 *
 * **Composición (v0.5.3):**
 * - Contratos Zod y parseo: `api/protocols/webviewProtocols.ts`
 * - HTML/CSP y plantilla: `ui/provider/webviewHtml.ts`
 * - Mensaje `settings` → webview: `api/settings/settingsPostMessage.ts`
 * - Mensaje `suggest`: `core/pipeline/suggestPipeline.ts`
 * - Router/handlers webview → host (`init`, `draftChanged`, `updateSetting`, `send`, `accept`): `api/protocols/inboundHandlers.ts`
 * - Lectura de workspace / contexto editor: `api/getters/workspaceGetters.ts`
 * - Actualización desde chips (`updateSetting`): `api/settings/applyWebviewUpdate.ts`
 *
 * Registra la vista en el activity bar y el panel inferior (C2).
 * Protocolo host↔webview:
 *   - `suggest`    (webview → host): solicitar suggestion para el texto parcial.
 *   - `loading`    (host → webview): suggestion en curso; opcional `phase`, `statusText` (fases OpenCode / Copilot).
 *   - `suggestion-stream` (host → webview): OpenCode — texto acumulado vía SSE antes del resultado final.
 *   - `suggestion` (host → webview): devolver el texto de la suggestion capturada.
 *   - `empty`      (host → webview): no hay suggestion disponible.
 *   - `error`      (host → webview): error al pedir suggestion.
 *   - `accept`     (webview → host): el usuario aceptó la suggestion con Tab.
 *   - `send`       (webview → host): enviar el prompt completo al chat de Copilot.
 *   - `clear`      (host → webview): resetear el input tras un envío exitoso.
 *   - `draftChanged` (webview → host): texto del borrador para sincronizar vistas.
 *   - `draftSync` / `draftHydrate` (host → webview): aplicar borrador remoto o estado inicial.
 *   - Mensajes de suggestion pueden llevar `broadcast: true` para espejar Sidebar + Panel.
 *   - Contratos Zod (`system/contracts/webviewMessageSchemas.ts` / `api/protocols/webviewProtocols.ts`): entrada webview → host y salida `settings`.
 */
import * as vscode from "vscode";
import { buildAndPostGhostPromptSettings } from "../../api/settings/settingsPostMessage";
import { buildGhostPromptWebviewHtml } from "./webviewHtml";
import { logDebugInfo } from '../../system/debug/SuggestionDebug';
import { getProjectMemoryBaseDir } from "../../core/memory/activate";
import {
  reconcileProjectMemoryForSuggest,
  writeReconciledProjectBootstrapSnapshot,
} from "../../core/memory/persist";
import { NodeProjectMemoryFs } from "../../core/memory/io/fs";
import { ProjectMemoryStore } from "../../core/memory/Store";
import {
  collectGhostPromptProjectContext,
  getGhostPromptContextMode,
  getGhostPromptMaxSuggestionChars,
  getGhostPromptProjectMemoryEnabled,
  getGhostPromptSelectedModelId,
  getGhostPromptSuggestionLanguage,
  getGhostPromptSuggestionLanguageChoice,
  getGhostPromptSuggestionLanguageMode,
  getGhostPromptSuggestionModelPolicy,
  getGhostPromptSuggestionStyle,
} from "../../api/getters/workspaceGetters";
import { handleGhostPromptSuggest } from "../../core/pipeline";
import {
  dispatchGhostPromptInboundMessage,
} from "../../api/protocols/inboundHandlers";
import type { GhostPromptSuggestDeps } from "../../core/pipeline";
import { parseWebviewInboundMessage, parseWebviewOutboundMessage } from "../../api/protocols/webviewProtocols";
import { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } from "../../destinations/vsOpenCodeX/vsOpenCodeXDestination";

export class MiniInputViewProvider implements vscode.WebviewViewProvider {
  /** View ID for the activity bar container. */
  public static readonly viewId = "ghostPrompt.input";
  /** View ID for the bottom panel container. */
  public static readonly panelViewId = "ghostPrompt.inputPanel";

  private static readonly _instances = new Set<MiniInputViewProvider>();

  private _view?: vscode.WebviewView;

  private _ghostProjectMemoryStore?: ProjectMemoryStore;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    /** Identificador de contribución de la vista (`ghostPrompt.input` vs `ghostPrompt.inputPanel`). */
    public readonly viewContributionId: string,
  ) {
    MiniInputViewProvider._instances.add(this);
  }

  private _getGhostProjectMemoryStore(): ProjectMemoryStore {
    this._ghostProjectMemoryStore ??= new ProjectMemoryStore(
      getProjectMemoryBaseDir(this._context.globalStorageUri.fsPath),
      new NodeProjectMemoryFs(),
    );
    return this._ghostProjectMemoryStore;
  }

  /**
   * Limpia el registro de instancias (solo tests; la extensión real mantiene 2 providers vivos).
   * @internal
   */
  public static clearWebviewRegistrationsForTests(): void {
    MiniInputViewProvider._instances.clear();
  }

  /**
   * Emite el mismo payload de UI a TODAS las instancias del webview registradas
   * (sidebar + panel inferior), añadiendo `broadcast: true` para que cada webview
   * pueda sincronizar su `captureId`. También forwardea a VSOpenCodeX si aplica.
   *
   * @param payload - Mensaje a emitir (se le añade `{ broadcast: true }`).
   *                 Se valida con `parseWebviewOutboundMessage` en desarrollo.
   */
  private static _broadcastUi(payload: Record<string, unknown>): void {
    const message = { ...payload, broadcast: true };
    parseWebviewOutboundMessage(message);
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(message);
    }
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(message);
  }

  /**
   * Propaga borrador a la otra vista GhostPrompt (Sidebar ↔ Panel).
   * @param originViewId
   * @param text
   */
  private static _broadcastDraftSync(originViewId: string, text: string): void {
    for (const instance of MiniInputViewProvider._instances) {
      if (instance.viewContributionId === originViewId) {
        continue;
      }
      const msg = { type: "draftSync" as const, text, originViewId };
      parseWebviewOutboundMessage(msg);
      instance._view?.webview.postMessage(msg);
    }
  }

  /** Vacía el composer en todas las vistas (p. ej. tras enviar al chat). */
  private static _broadcastClearAll(): void {
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: "clear",
      broadcast: true,
    });
    const msg = { type: "clear" as const };
    parseWebviewOutboundMessage(msg);
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(msg);
    }
  }

  private static ghostPromptSuggestDeps(
    provider: MiniInputViewProvider | undefined,
  ): GhostPromptSuggestDeps {
    const base: GhostPromptSuggestDeps = {
      broadcastUi: MiniInputViewProvider._broadcastUi,
      getSuggestionModelPolicy: () => getGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getSuggestionStyle: () => getGhostPromptSuggestionStyle(),
      getContextMode: () => getGhostPromptContextMode(),
      getSuggestionLanguageMode: () => getGhostPromptSuggestionLanguageMode(),
      getSuggestionLanguage: () => getGhostPromptSuggestionLanguage(),
      getMaxSuggestionChars: () => getGhostPromptMaxSuggestionChars(),
      collectProjectContext: () => collectGhostPromptProjectContext(),
    };
    if (!provider || !getGhostPromptProjectMemoryEnabled()) {
      return base;
    }
    return {
      ...base,
      reconcileGhostPromptBootstrap: (args) =>
        reconcileProjectMemoryForSuggest({
          store: provider._getGhostProjectMemoryStore(),
          ...args,
        }),
      writeGhostPromptBootstrapSnapshot: (snapshot) =>
        writeReconciledProjectBootstrapSnapshot({
          store: provider._getGhostProjectMemoryStore(),
          workspaceKey: snapshot.workspaceKey,
          mergedItems: snapshot.mergedItems,
        }),
    };
  }

  /**
   * API para VSOpenCodeX (executeCommand): ejecuta el pipeline de suggestion con el texto actual del chat VSX.
   * Ignorar cuando el usuario usa destino Copilot (sigue usando la webview).
   * @param text
   */
  public static async runSuggestFromExternalHost(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const first =
      [...MiniInputViewProvider._instances][0] ??
      undefined;
    const captureId = Date.now();
    await handleGhostPromptSuggest(
      { type: "suggest", text: trimmed, captureId },
      MiniInputViewProvider.ghostPromptSuggestDeps(first),
    );
  }

  private async _postSettings(webview: vscode.Webview): Promise<void> {
    await buildAndPostGhostPromptSettings(webview, {
      getSuggestionModelPolicy: () => getGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getSuggestionStyle: () => getGhostPromptSuggestionStyle(),
      getContextMode: () => getGhostPromptContextMode(),
      getSuggestionLanguageChoice: () => getGhostPromptSuggestionLanguageChoice(),
    });
  }

  private async _postSettingsIfReady(): Promise<void> {
    if (!this._view) {
      return;
    }
    await this._postSettings(this._view.webview);
  }

  private static async _broadcastSettingsToAllViews(): Promise<void> {
    await Promise.all(
      Array.from(MiniInputViewProvider._instances, (instance) =>
        instance._postSettingsIfReady(),
      ),
    );
  }

  /** Actualiza chips + lista de modelos en Sidebar y Panel (tras cambiar Settings). */
  public static async refreshSettingsAllViews(): Promise<void> {
    await MiniInputViewProvider._broadcastSettingsToAllViews();
  }

  /**
   * Payload opcional para `window.__ghostPromptCapabilities` (webview).
   *
   * **Paridad v0.3.1:** Sidebar (`ghostPrompt.input`) y Panel (`ghostPrompt.inputPanel`)
   * comparten el mismo bundle React (`dist/react/index.html`); este objeto debe ser **funcionalmente
   * idéntico** para ambas contribuciones (misma forma y mismos flags). Solo se permiten
   * claves que afecten **presentación** en CSS (p. ej. `compactToolbar`), nunca un catálogo
   * distinto de controles por vista.
   *
   * Por defecto vacío: misma UX en ambas superficies.
   * @returns Payload de capacidades para el webview.
   */
  private _webviewCapabilitiesPayload(): Record<string, unknown> {
    return {};
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    const { extensionUri, storageUri, globalStorageUri } = this._context;
    const dataUri = storageUri ?? globalStorageUri;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "src", "ui", "webview"),
        vscode.Uri.joinPath(extensionUri, "src", "ui", "webview", "dist", "react"),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (raw: unknown) => {
      logDebugInfo("Received raw webview message.");
      const message = parseWebviewInboundMessage(raw);
      if (!message) {
        logDebugInfo("Webview inbound message failed validation.");
        return;
      }
      logDebugInfo(`Parsed webview message type=${message.type}`);
      await dispatchGhostPromptInboundMessage(message, {
        viewContributionId: this.viewContributionId,
        webview: webviewView.webview,
        dataUri,
        postSettings: (w) => this._postSettings(w),
        broadcastDraftSync: MiniInputViewProvider._broadcastDraftSync,
        broadcastSettingsToAllViews:
          MiniInputViewProvider._broadcastSettingsToAllViews,
        broadcastClearAll: MiniInputViewProvider._broadcastClearAll,
        broadcastUi: MiniInputViewProvider._broadcastUi,
        suggestDeps:
          MiniInputViewProvider.ghostPromptSuggestDeps(this),
      });
    });
  }

  /**
   * Builds HTML from the React webview bundle and injects secure asset URIs and the CSP nonce.
   *
   * @param webview - The webview instance to generate HTML for.
   * @returns HTML string for the webview.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return buildGhostPromptWebviewHtml({
      extensionUri: this._context.extensionUri,
      webview,
      viewContributionId: this.viewContributionId,
      capabilitiesPayload: this._webviewCapabilitiesPayload(),
    });
  }
}
