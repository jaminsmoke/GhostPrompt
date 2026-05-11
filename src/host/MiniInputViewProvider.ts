/**
 * @fileoverview WebviewViewProvider para el input de GhostPrompt.
 *
 * **Composición (v0.3.2 fase A):**
 * - Contratos Zod y parseo: `webviewProtocols.ts` (schemas en `../shared/webviewMessageSchemas.ts`)
 * - HTML/CSP y plantilla: `ghostPromptWebviewHtml.ts`
 * - Mensaje `settings` → webview: `ghostPromptSettingsPostMessage.ts`
 * - Mensaje `suggest`: `handleGhostPromptSuggest.ts` → `ghostPromptSuggestPipeline.ts`
 * - Router/handlers webview → host (`init`, `draftChanged`, `updateSetting`, `send`, `accept`): `ghostPromptWebviewInboundHandlers.ts`
 * - Lectura de workspace / contexto editor: `ghostPromptHostWorkspaceGetters.ts`
 * - Actualización desde chips (`updateSetting`): `applyWebviewUpdateSetting.ts`
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
 *   - Contratos Zod (`shared/webviewMessageSchemas.ts` / `webviewProtocols.ts`): entrada webview → host y salida `settings`.
 */
import * as vscode from "vscode";
import { warmOpenCodeRuntimeIfConfigured } from "../opencode/warmOpenCodeRuntime";
import { ghostPromptSessionStore } from "../session/GhostPromptSessionStore";
import { buildAndPostGhostPromptSettings } from "./ghostPromptSettingsPostMessage";
import { buildGhostPromptWebviewHtml } from "./ghostPromptWebviewHtml";
import { getProjectMemoryBaseDir } from "../projectMemory/activateProjectMemory";
import {
  reconcileProjectMemoryForSuggest,
  writeReconciledProjectBootstrapSnapshot,
} from "../projectMemory/persistProjectBootstrapSnapshot";
import { NodeProjectMemoryFs } from "../projectMemory/projectMemoryNodeFs";
import { ProjectMemoryStore } from "../projectMemory/ProjectMemoryStore";
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
} from "./ghostPromptHostWorkspaceGetters";
import { handleGhostPromptSuggest } from "./handleGhostPromptSuggest";
import {
  dispatchGhostPromptInboundMessage,
} from "./ghostPromptWebviewInboundHandlers";
import type { GhostPromptSuggestDeps } from "./ghostPromptSuggestPipeline";
import { parseWebviewInboundMessage } from "./webviewProtocols";
import { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } from "./vsOpenCodeXGhostPromptUiBridge";

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

  /** Emite a todas las vistas el mismo UI de suggestion/loading/idioma (`broadcast: true` en webview). */
  private static _broadcastUi(payload: Record<string, unknown>): void {
    const message = { ...payload, broadcast: true };
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(message);
    }
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(message);
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
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: "clear",
      broadcast: true,
    });
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage({ type: "clear" });
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
   * comparten el mismo `index.html` / `dist/main.js`; este objeto debe ser **funcionalmente
   * idéntico** para ambas contribuciones (misma forma y mismos flags). Solo se permiten
   * claves que afecten **presentación** en CSS (p. ej. `compactToolbar`), nunca un catálogo
   * distinto de controles por vista.
   *
   * Por defecto vacío: misma UX en ambas superficies.
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
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    warmOpenCodeRuntimeIfConfigured();

    webviewView.webview.onDidReceiveMessage(async (raw: unknown) => {
      const message = parseWebviewInboundMessage(raw);
      if (!message) {
        return;
      }
      await dispatchGhostPromptInboundMessage(message, {
        viewContributionId: this.viewContributionId,
        webview: webviewView.webview,
        dataUri,
        postSettings: (w) => this._postSettings(w),
        broadcastDraftSync: MiniInputViewProvider._broadcastDraftSync,
        broadcastSettingsToAllViews:
          MiniInputViewProvider._broadcastSettingsToAllViews,
        broadcastClearAll: MiniInputViewProvider._broadcastClearAll,
        suggestDeps:
          MiniInputViewProvider.ghostPromptSuggestDeps(this),
      });
    });
  }

  /**
   * Loads `webview/index.html` and injects secure asset URIs and the CSP nonce.
   *
   * @param webview - The webview instance to generate HTML for.
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
