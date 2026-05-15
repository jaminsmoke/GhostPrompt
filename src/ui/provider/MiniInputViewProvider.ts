/**
 * WebviewViewProvider para el input de GhostPrompt.
 *
 * Composición de dependencias y flujos para GhostPrompt input v0.5.3.
 *
 * - Contratos Zod y parseo: `api/protocols/webviewProtocols.ts`.
 * - HTML/CSP y plantilla: `ui/provider/webviewHtml.ts`.
 * - Mensaje `settings` → webview: `api/settings/settingsPostMessage.ts`.
 * - Mensaje `suggest`: `core/suggest/runSuggest.ts`.
 * - Router/handlers webview → host (`init`, `draftChanged`, `updateSetting`, `send`, `accept`): `api/protocols/inboundHandlers.ts`.
 * - Lectura de workspace / contexto editor: `api/getters/workspaceGetters.ts`.
 * - Actualización desde chips (`updateSetting`): `api/settings/applyWebviewUpdate.ts`.
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
 *   - Contratos Zod (`api/contracts/webviewMessageSchemas.ts` / `api/protocols/webviewProtocols.ts`): entrada webview → host y salida `settings`.
 */
import * as vscode from 'vscode';
import { buildAndPostGhostPromptSettings } from '../../api/settings/settingsPostMessage';
import { buildGhostPromptWebviewHtml } from './webviewHtml';
import { getLogger } from '../../system/log';
import {
  getGhostPromptMaxSuggestionChars,
  getGhostPromptSelectedModelId,
  getGhostPromptSuggestionLanguageChoice,
  getGhostPromptSuggestionModelPolicy,
  getGhostPromptSuggestionStyle,
} from '../../api/getters/workspaceGetters';
import { handleGhostPromptSuggest } from '../../core/suggest';
import { dispatchGhostPromptInboundMessage } from '../../api/protocols/inboundHandlers';
import type { GhostPromptSuggestDeps } from '../../core/suggest';
import {
  parseWebviewInboundMessage,
  parseWebviewOutboundMessage,
} from '../../api/protocols/webviewProtocols';
import { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } from '../../destinations/vsOpenCodeX/vsOpenCodeXDestination';
import { maybeNotifySuggestionIssue } from '../notifications/suggestionNotification';
import { ollamaModelManager } from '../../engines/ollama';
import { providerStatusManager } from '../../core/status';
import { looksLikeOllamaModelId } from '../../core/routing/sources';

export class MiniInputViewProvider implements vscode.WebviewViewProvider {
  /** View ID for the activity bar container. */
  public static readonly viewId = 'ghostPrompt.input';
  /** View ID for the bottom panel container. */
  public static readonly panelViewId = 'ghostPrompt.inputPanel';

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

  /**
   * Emite el mismo payload de UI a TODAS las instancias del webview registradas
   * (sidebar + panel inferior), añadiendo `broadcast: true` para que cada webview
   * pueda sincronizar su `captureId`. También forwardea a VSOpenCodeX si aplica.
   *
   * @param {Record<string, unknown>} payload - Mensaje a emitir (se le añade `{ broadcast: true }`).
   *                 Se valida con `parseWebviewOutboundMessage` en desarrollo.
   * @returns {void}
   */
  private static _broadcastUi(payload: Record<string, unknown>): void {
    const message = { ...payload, broadcast: true };
    const validated = parseWebviewOutboundMessage(message);
    if (!validated) {
      return;
    }
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(validated);
    }
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(validated);
  }

  /**
   * Propaga borrador a la otra vista GhostPrompt (Sidebar ↔ Panel).
   * @param {string} originViewId Identificador de la vista origen que no debe recibir el sync.
   * @param {string} text Texto del borrador que se sincroniza.
   * @returns {void}
   */
  private static _broadcastDraftSync(originViewId: string, text: string): void {
    for (const instance of MiniInputViewProvider._instances) {
      if (instance.viewContributionId === originViewId) {
        continue;
      }
      const msg = { type: 'draftSync' as const, text, originViewId };
      const validated = parseWebviewOutboundMessage(msg);
      if (!validated) {
        continue;
      }
      instance._view?.webview.postMessage(validated);
    }
  }

  /** Vacía el composer en todas las vistas (p. Ej. Tras enviar al chat). */
  private static _broadcastClearAll(): void {
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: 'clear',
      broadcast: true,
    });
    const msg = { type: 'clear' as const };
    const validated = parseWebviewOutboundMessage(msg);
    if (!validated) {
      return;
    }
    for (const instance of MiniInputViewProvider._instances) {
      instance._view?.webview.postMessage(validated);
    }
  }

  private static ghostPromptSuggestDeps(): GhostPromptSuggestDeps {
    return {
      broadcastUi: MiniInputViewProvider._broadcastUi,
      getSuggestionModelPolicy: () => getGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getSuggestionStyle: () => getGhostPromptSuggestionStyle(),
      getMaxSuggestionChars: () => getGhostPromptMaxSuggestionChars(),
      notifyIssue: maybeNotifySuggestionIssue,
    };
  }

  /**
   * API para VSOpenCodeX (executeCommand): ejecuta el pipeline de suggestion con el texto actual del chat VSX.
   * Ignorar cuando el usuario usa destino Copilot (sigue usando la webview).
   * @param {string} text Texto que se debe sugerir desde el host externo.
   * @returns {Promise<void>} Promise que indica cuando el proceso de suggest se completa.
   */
  public static async runSuggestFromExternalHost(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const captureId = Date.now();
    await handleGhostPromptSuggest(
      { type: 'suggest', text: trimmed, captureId },
      MiniInputViewProvider.ghostPromptSuggestDeps(),
    );
  }

  private async _postSettings(webview: vscode.Webview): Promise<void> {
    await buildAndPostGhostPromptSettings(webview, {
      getSuggestionModelPolicy: () => getGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getSuggestionStyle: () => getGhostPromptSuggestionStyle(),
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
      Array.from(MiniInputViewProvider._instances, (instance) => instance._postSettingsIfReady()),
    );
  }

  /** Actualiza chips + lista de modelos en Sidebar y Panel (tras cambiar Settings). */
  public static async refreshSettingsAllViews(): Promise<void> {
    await MiniInputViewProvider._broadcastSettingsToAllViews();
  }

  /**
   * Maneja efectos secundarios de cambio de modelo/provider (Ollama lifecycle).
   * Extraído de `inboundHandlers.ts` para separar lógica de negocio del protocol handler.
   * @param {string} key Clave de configuración cambiada.
   * @param {string} value Nuevo valor de la configuración.
   * @returns {Promise<void>} Promise que se resuelve cuando el lifecycle termina.
   */
  private static async _onSettingChanged(
    key: 'selectedModelId' | 'completionProvider',
    value: string,
  ): Promise<void> {
    if (key === 'selectedModelId' && looksLikeOllamaModelId(value)) {
      ollamaModelManager.stopAll();
      try {
        await ollamaModelManager.startModel(value);
      } catch {
        // Best-effort: el status se refresca igual.
      }
      const providers = await providerStatusManager.refreshAll();
      MiniInputViewProvider._broadcastUi({ type: 'providerStatus', providers });
    }

    if (key === 'completionProvider' && value !== 'ollama') {
      ollamaModelManager.stopAll();
      const providers = await providerStatusManager.refreshAll();
      MiniInputViewProvider._broadcastUi({ type: 'providerStatus', providers });
    }
  }

  /**
   * Payload opcional para `window.__ghostPromptCapabilities` (webview).
   *
   * **Paridad v0.3.1:** Sidebar (`ghostPrompt.input`) y Panel (`ghostPrompt.inputPanel`)
   * comparten el mismo bundle React (`dist/react/index.html`); este objeto debe ser **funcionalmente
   * idéntico** para ambas contribuciones (misma forma y mismos flags). Solo se permiten
   * claves que afecten **presentación** en CSS (p. Ej. `compactToolbar`), nunca un catálogo
   * distinto de controles por vista.
   *
   * Por defecto vacío: misma UX en ambas superficies.
   * @returns {Record<string, unknown>} Payload de capacidades para el webview.
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
        vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'webview'),
        vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'webview', 'dist', 'react'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (raw: unknown) => {
      const uiLog = getLogger('ui');
      uiLog.debug('webview-raw-message', {});
      const message = parseWebviewInboundMessage(raw);
      if (!message) {
        uiLog.debug('webview-inbound-invalid', {});
        return;
      }
      uiLog.debug('webview-inbound-parsed', { type: message.type });
      await dispatchGhostPromptInboundMessage(message, {
        viewContributionId: this.viewContributionId,
        webview: webviewView.webview,
        dataUri,
        postSettings: (w) => this._postSettings(w),
        broadcastDraftSync: MiniInputViewProvider._broadcastDraftSync,
        broadcastSettingsToAllViews: MiniInputViewProvider._broadcastSettingsToAllViews,
        broadcastClearAll: MiniInputViewProvider._broadcastClearAll,
        broadcastUi: MiniInputViewProvider._broadcastUi,
        suggestDeps: MiniInputViewProvider.ghostPromptSuggestDeps(),
        onSettingChanged: MiniInputViewProvider._onSettingChanged,
      });
    });
  }

  /**
   * Builds HTML from the React webview bundle and injects secure asset URIs and the CSP nonce.
   *
   * @param {vscode.Webview} webview - The webview instance to generate HTML for.
   * @returns {string} HTML string for the webview.
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
