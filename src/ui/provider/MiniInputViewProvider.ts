/**
 * @file WebviewViewProvider para el input de GhostPrompt.
 *
 * WebviewViewProvider para el input de GhostPrompt.
 *
 * Composición de dependencias y flujos para GhostPrompt input v0.5.3.
 *
 * - Contratos Zod: `protocols/validations/schemas/`; parseo boundary: `api/boundary/webviewProtocols.ts`.
 * - HTML/CSP y plantilla: `ui/provider/webviewHtml.ts`.
 * - Mensaje `settings` → webview: `api/settings/settingsPostMessage.ts`.
 * - Mensaje `suggest`: `core/suggest/runSuggest.ts`.
 * - Handlers webview → host: `api/boundary/inboundHandlers.ts`.
 * - Workspace y política de modelo: `system/internals/config/read/`.
 * - Actualización desde chips (`updateSetting`): `system/internals/config/write/`.
 *
 * Registra la vista en el activity bar y el panel inferior (C2).
 * Protocolo host↔webview:
 * - `suggest` (webview → host): solicitar suggestion para el texto parcial.
 * - `loading` (host → webview): suggestion en curso; opcional `phase`, `statusText` (fases OpenCode / Copilot).
 * - `suggestion-stream` (host → webview): OpenCode — texto acumulado vía SSE antes del resultado final.
 * - `suggestion` (host → webview): devolver el texto de la suggestion capturada.
 * - `empty` (host → webview): no hay suggestion disponible.
 * - `error` (host → webview): error al pedir suggestion.
 * - `accept` (webview → host): el usuario aceptó la suggestion con Tab.
 * - `send` (webview → host): enviar el prompt completo al chat de Copilot.
 * - `clear` (host → webview): resetear el input tras un envío exitoso.
 * - `draftChanged` (webview → host): texto del borrador (solo superficie chat persiste en el host).
 * - `draftHydrate` (host → webview): aplicar borrador al abrir la vista chat.
 * - Mensajes de suggestion pueden llevar `broadcast: true` para correlación de `captureId` en la vista chat.
 * - Esquemas Zod en `zschemWebviewMessages.ts`; parseo en `api/boundary/webviewProtocols.ts`.
 */
import * as vscode from 'vscode';

import { dispatchGhostPromptInboundMessage } from '../../api/boundary/inboundHandlers';
import {
  parseWebviewInboundMessage,
  parseWebviewOutboundMessage,
} from '../../api/boundary/webviewProtocols';
import { buildAndPostGhostPromptSettings } from '../../api/settings/settingsPostMessage';
import { forwardGhostPromptInlineUiToVsOpenCodeIfApplicable } from '../../destinations/vsOpenCodeX/vsOpenCodeXDestination';
import { ollamaModelManager } from '../../engines/provider/ollama';
import { readGhostPromptSuggestionModelPolicy } from '../../system/internals/config/read/readGhostPromptSuggestionModelPolicy';
import {
  getGhostPromptMaxSuggestionChars,
  getGhostPromptSelectedModelId,
} from '../../system/internals/config/read/workspaceConfigGetters';
import { looksLikeOllamaModelId } from '../../system/internals/protocols/guards/guardModelRouting';
import { getLogger, reportHostFault } from '../../system/log';
import { providerStatusManager } from '../../system/runtime/providers/providerStatusManager';
import {
  handleGhostPromptSuggest,
  type GhostPromptSuggestDeps,
} from '../../system/runtime/suggest/suggestPipeline';
import { maybeNotifySuggestionIssue } from '../notifications/suggestionNotification';

import { buildGhostPromptWebviewFaultHtml, buildGhostPromptWebviewHtml } from './webviewHtml';

export class MiniInputViewProvider implements vscode.WebviewViewProvider {
  /** View ID for the activity bar container. */
  public static readonly viewId = 'ghostPrompt.input';
  /** View ID for the bottom panel container. */
  public static readonly panelViewId = 'ghostPrompt.inputPanel';

  private static readonly instances = new Set<MiniInputViewProvider>();

  /** Tipos host→webview que solo deben aplicarse en la superficie chat (sidebar). */
  private static readonly chatOnlyOutboundUiTypes = new Set<string>([
    'loading',
    'suggestion',
    'suggestion-stream',
    'empty',
    'error',
    'clear',
  ]);

  private webviewView?: vscode.WebviewView;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    /** Identificador de contribución de la vista (`ghostPrompt.input` vs `ghostPrompt.inputPanel`). */
    public readonly viewContributionId: string,
  ) {
    MiniInputViewProvider.instances.add(this);
  }

  /**
   * `chat` = sidebar; `hub` = panel de ajustes.
   * @returns {'chat' | 'hub'} Rol de la superficie según el id de contribución de la vista.
   */
  public get surfaceRole(): 'chat' | 'hub' {
    return this.viewContributionId === MiniInputViewProvider.panelViewId ? 'hub' : 'chat';
  }

  /**
   * Limpia el registro de instancias (solo tests; la extensión real mantiene 2 providers vivos).
   * @internal
   */
  public static clearWebviewRegistrationsForTests(): void {
    MiniInputViewProvider.instances.clear();
  }

  /**
   * Emite UI a las instancias del webview. Suggestion/carga/clear solo en **chat**;
   * `settings` y `providerStatus` a todas. Forwardea a VSOpenCodeX si aplica.
   * @param {Record<string, unknown>} payload - Mensaje (se añade `broadcast: true` cuando aplica).
   * @returns {void}
   */
  private static broadcastUi(payload: Record<string, unknown>): void {
    const message = { ...payload, broadcast: true };
    const validated = parseWebviewOutboundMessage(message);
    if (!validated) {
      return;
    }
    const chatOnly = MiniInputViewProvider.chatOnlyOutboundUiTypes.has(validated.type);
    for (const instance of MiniInputViewProvider.instances) {
      if (!chatOnly || instance.surfaceRole === 'chat') {
        instance.webviewView?.webview.postMessage(validated);
      }
    }
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(validated);
  }

  /** Vacía el compositor solo en la vista chat (tras enviar al destino). */
  private static broadcastClearAll(): void {
    forwardGhostPromptInlineUiToVsOpenCodeIfApplicable({
      type: 'clear',
      broadcast: true,
    });
    const msg = { type: 'clear' as const };
    const validated = parseWebviewOutboundMessage(msg);
    if (!validated) {
      return;
    }
    for (const instance of MiniInputViewProvider.instances) {
      if (instance.surfaceRole === 'chat') {
        instance.webviewView?.webview.postMessage(validated);
      }
    }
  }

  private static ghostPromptSuggestDeps(): GhostPromptSuggestDeps {
    return {
      broadcastUi: (...args: Parameters<typeof MiniInputViewProvider.broadcastUi>) =>
        MiniInputViewProvider.broadcastUi(...args),
      getSuggestionModelPolicy: () => readGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getMaxSuggestionChars: () => getGhostPromptMaxSuggestionChars(),
      notifyIssue: maybeNotifySuggestionIssue,
    };
  }

  /**
   * API para VSOpenCodeX (executeCommand): ejecuta el pipeline de suggestion con el texto actual del chat VSX.
   * Ignorar cuando el usuario usa destino Copilot (sigue usando la webview).
   * @param {string} text - Texto que se debe sugerir desde el host externo.
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

  private static async postSettings(webview: vscode.Webview): Promise<void> {
    await buildAndPostGhostPromptSettings(webview, {
      getSuggestionModelPolicy: () => readGhostPromptSuggestionModelPolicy(),
      getSelectedModelId: () => getGhostPromptSelectedModelId(),
      getMaxSuggestionChars: () => getGhostPromptMaxSuggestionChars(),
    });
  }

  private async postSettingsIfReady(): Promise<void> {
    if (!this.webviewView) {
      return;
    }
    await MiniInputViewProvider.postSettings(this.webviewView.webview);
  }

  private static async broadcastSettingsToAllViews(): Promise<void> {
    await Promise.all(
      Array.from(MiniInputViewProvider.instances, (instance) => instance.postSettingsIfReady()),
    );
  }

  /** Actualiza chips + lista de modelos en Sidebar y Panel (tras cambiar Settings). */
  public static async refreshSettingsAllViews(): Promise<void> {
    await MiniInputViewProvider.broadcastSettingsToAllViews();
  }

  /**
   * Maneja efectos secundarios de cambio de modelo/provider (Ollama lifecycle).
   * Extraído de `inboundHandlers.ts` para separar lógica de negocio del protocol handler.
   * @param {string} key - Clave de configuración cambiada.
   * @param {string} value - Nuevo valor de la configuración.
   * @returns {Promise<void>} Promise que se resuelve cuando el lifecycle termina.
   */
  private static async onSettingChanged(
    key: 'completionProvider' | 'selectedModelId',
    value: string,
  ): Promise<void> {
    if (key === 'selectedModelId' && looksLikeOllamaModelId(value)) {
      await ollamaModelManager.stopAll();
      try {
        await ollamaModelManager.startModel(value);
      } catch {
        // Best-effort: el status se refresca igual.
      }
      const providers = await providerStatusManager.refreshAll();
      MiniInputViewProvider.broadcastUi({ type: 'providerStatus', providers });
    }

    if (key === 'completionProvider' && value !== 'ollama') {
      await ollamaModelManager.stopAll();
      const providers = await providerStatusManager.refreshAll();
      MiniInputViewProvider.broadcastUi({ type: 'providerStatus', providers });
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
  private webviewCapabilitiesPayload(): Record<string, unknown> {
    return {};
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _cancellationToken: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;
    const { extensionUri, storageUri, globalStorageUri } = this.extensionContext;
    const dataUri = storageUri ?? globalStorageUri;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'webview', 'dist', 'react'),
      ],
    };

    try {
      const html = this.getHtmlForWebview(webviewView.webview);
      webviewView.webview.html = html;
      getLogger('ui').info('webview-resolved', {
        viewContributionId: this.viewContributionId,
        htmlLength: html.length,
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      getLogger('ui').error('webview-html-failed', { viewContributionId: this.viewContributionId }, error);
      reportHostFault('ui', 'webview-html-failed', error);
      webviewView.webview.html = buildGhostPromptWebviewFaultHtml(detail);
      return;
    }

    webviewView.webview.onDidReceiveMessage(async (raw: unknown) => {
      const uiLog = getLogger('ui');
      uiLog.debug('webview-raw-message', {});
      const message = parseWebviewInboundMessage(raw);
      if (!message) {
        uiLog.debug('webview-inbound-invalid', {});
        return;
      }
      uiLog.debug('webview-inbound-parsed', { type: message.type });
      try {
        await dispatchGhostPromptInboundMessage(message, {
          viewContributionId: this.viewContributionId,
          surfaceRole: this.surfaceRole,
          webview: webviewView.webview,
          dataUri,
          postSettings: (w) => MiniInputViewProvider.postSettings(w),
          broadcastSettingsToAllViews: (
            ...args: Parameters<typeof MiniInputViewProvider.broadcastSettingsToAllViews>
          ) => MiniInputViewProvider.broadcastSettingsToAllViews(...args),
          broadcastClearAll: (...args: Parameters<typeof MiniInputViewProvider.broadcastClearAll>) =>
            MiniInputViewProvider.broadcastClearAll(...args),
          broadcastUi: (...args: Parameters<typeof MiniInputViewProvider.broadcastUi>) =>
            MiniInputViewProvider.broadcastUi(...args),
          suggestDeps: MiniInputViewProvider.ghostPromptSuggestDeps(),
          onSettingChanged: (...args: Parameters<typeof MiniInputViewProvider.onSettingChanged>) =>
            MiniInputViewProvider.onSettingChanged(...args),
        });
      } catch (error: unknown) {
        uiLog.error('webview-dispatch-failed', { type: message.type }, error);
        reportHostFault('ui', 'webview-dispatch-failed', error);
      }
    });
  }

  /**
   * Builds HTML from the React webview bundle and injects secure asset URIs and the CSP nonce.
   * @param {vscode.Webview} webview - The webview instance to generate HTML for.
   * @returns {string} HTML string for the webview.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return buildGhostPromptWebviewHtml({
      extensionUri: this.extensionContext.extensionUri,
      webview,
      viewContributionId: this.viewContributionId,
      capabilitiesPayload: this.webviewCapabilitiesPayload(),
    });
  }
}
