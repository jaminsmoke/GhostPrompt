/**
 * Handlers por `message.type` del canal webview → host (init, suggest, send, …).
 * Router: `dispatchGhostPromptInboundMessage`. Roadmap v0.3.2 fase A.
 */
import * as vscode from 'vscode';
import {
  getActiveDestinationProvider,
  getGhostPromptAgentDestination,
} from '../../destinations/destinationRegistry';
import { append as appendLog } from '../../system/log/ConversationLog';
import { appendSuggestion } from '../../system/log/SuggestionLog';
import { ghostPromptSessionStore } from '../../core/session/GhostPromptSessionStore';
import { applyWebviewUpdateSetting } from '../settings/applyWebviewUpdate';
import { logDebugInfo } from '../../system/debug/SuggestionDebug';
import { type GhostPromptSuggestDeps, handleGhostPromptSuggest } from '../../core/pipeline';
import { providerStatusManager } from '../../system/status';
import { ollamaModelManager } from '../../engines/ollama';
import { looksLikeOllamaModelId } from '../../core/sources';
import { parseWebviewOutboundMessage } from './webviewProtocols';
import type { WebviewInboundMessage } from './webviewProtocols';

export type GhostPromptInboundBroadcastServices = {
  broadcastDraftSync: (originViewId: string, text: string) => void;
  broadcastSettingsToAllViews: () => Promise<void>;
  broadcastClearAll: () => void;
  broadcastUi: (payload: Record<string, unknown>) => void;
};

export type GhostPromptInboundDispatchServices = GhostPromptInboundBroadcastServices & {
  viewContributionId: string;
  webview: vscode.Webview;
  /** `storageUri ?? GlobalStorageUri` del ExtensionContext (siempre hay `globalStorageUri`). */
  dataUri: vscode.Uri;
  postSettings: (webview: vscode.Webview) => Promise<void>;
  suggestDeps: GhostPromptSuggestDeps;
};

/**
 * Inicializa la vista webview y envía el estado inicial a la UI.
 * @param {vscode.Webview} webview Webview que recibe el mensaje init.
 * @param {(w: vscode.Webview) => Promise<void>} postSettings Callback para enviar el payload de configuración.
 * @return {Promise<void>} Promise que se resuelve cuando la inicialización termina.
 */
export async function handleGhostPromptInboundInit(
  webview: vscode.Webview,
  postSettings: (w: vscode.Webview) => Promise<void>,
): Promise<void> {
  await postSettings(webview);
  const draftPayload = {
    type: 'draftHydrate' as const,
    text: ghostPromptSessionStore.getSnapshot().draftText,
  };
  const validated = parseWebviewOutboundMessage(draftPayload);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
}

/**
 * Maneja actualizaciones del borrador desde la UI del webview.
 * @param {WebviewInboundMessage} message Mensaje de tipo draftChanged.
 * @param {Pick<GhostPromptInboundDispatchServices, "viewContributionId" | "broadcastDraftSync">} services Servicios de broadcast para sincronizar borradores.
 * @return {void} Void.
 */
export function handleGhostPromptInboundDraftChanged(
  message: Extract<WebviewInboundMessage, { type: 'draftChanged' }>,
  services: Pick<GhostPromptInboundDispatchServices, 'viewContributionId' | 'broadcastDraftSync'>,
): void {
  if (message.originViewId !== services.viewContributionId) {
    return;
  }
  ghostPromptSessionStore.patchState({ draftText: message.text });
  services.broadcastDraftSync(message.originViewId, message.text);
}

/**
 * Aplica un cambio de configuración originado en el webview y notifica a todas
 * las vistas. Efectos secundarios:
 * - Si se selecciona un modelo Ollama (`selectedModelId` con formato Ollama):
 *   detiene el modelo anterior, inicia el nuevo vía `ollamaModelManager`
 * - Si se cambia de motor (`completionProvider`) a != Ollama: detiene modelos Ollama.
 *
 * @param {WebviewInboundMessage} message Mensaje `updateSetting` del webview.
 * @param {() => Promise<void>} broadcastSettingsToAllViews Callback para re-enviar settings a todas las vistas.
 * @param {GhostPromptInboundDispatchServices | undefined} [dispatchServices] Servicios de dispatch (broadcastUi, etc.), opcional.
 * @return {Promise<void>} Promise que se resuelve cuando la actualización termina.
 */
export async function handleGhostPromptInboundUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: 'updateSetting' }>,
  broadcastSettingsToAllViews: () => Promise<void>,
  dispatchServices?: GhostPromptInboundDispatchServices,
): Promise<void> {
  await applyWebviewUpdateSetting(message);
  await broadcastSettingsToAllViews();

  if (message.key === 'selectedModelId' && message.value && dispatchServices) {
    if (looksLikeOllamaModelId(message.value)) {
      ollamaModelManager.stopAll();
      ollamaModelManager
        .startModel(message.value)
        .then(async () => {
          const providers = await providerStatusManager.refreshAll();
          dispatchServices!.broadcastUi({ type: 'providerStatus', providers });
        })
        .catch(async () => {
          const providers = await providerStatusManager.refreshAll();
          dispatchServices!.broadcastUi({ type: 'providerStatus', providers });
        });
    }
  }

  if (message.key === 'completionProvider' && dispatchServices) {
    if (message.value !== 'ollama') {
      ollamaModelManager.stopAll();
      const providers = await providerStatusManager.refreshAll();
      dispatchServices.broadcastUi({ type: 'providerStatus', providers });
    }
  }
}

/**
 * Maneja la aceptación de una sugerencia y la guarda en el historial.
 * @param {WebviewInboundMessage} message Mensaje de tipo accept con la sugerencia seleccionada.
 * @param {vscode.Uri} dataUri Ubicación de almacenamiento para el registro de sugerencias.
 * @return {Promise<void>} Promise que se resuelve cuando la sugerencia se registra.
 */
export async function handleGhostPromptInboundAccept(
  message: Extract<WebviewInboundMessage, { type: 'accept' }>,
  dataUri: vscode.Uri,
): Promise<void> {
  ghostPromptSessionStore.patchState({
    lastAcceptedSuggestion: message.suggestion,
  });
  await appendSuggestion(dataUri, message.context, message.suggestion);
}

/**
 * Maneja el envío de texto al destino configurado desde el webview.
 * @param {WebviewInboundMessage} message Mensaje de tipo send con el texto a enviar.
 * @param {vscode.Uri} dataUri URI de almacenamiento para registro de envíos.
 * @param {() => void} broadcastClearAll Callback para limpiar el estado de sugerencia en la UI.
 * @return {Promise<void>} Promise que se resuelve cuando el envío se procesa.
 */
export async function handleGhostPromptInboundSend(
  message: Extract<WebviewInboundMessage, { type: 'send' }>,
  dataUri: vscode.Uri,
  broadcastClearAll: () => void,
): Promise<void> {
  if (getGhostPromptAgentDestination() === 'vsOpenCodeX') {
    return;
  }
  if (!message.text) {
    return;
  }
  const provider = getActiveDestinationProvider();
  if (typeof provider.sendPrompt !== 'function') {
    void vscode.window.showErrorMessage(
      `GhostPrompt: destino '${provider.id}' no tiene función de envío registrada.`,
    );
    return;
  }
  try {
    await provider.sendPrompt(message.text);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `GhostPrompt: no se pudo enviar al destino '${provider.id}': ${messageText}`,
    );
    return;
  }
  const recent = [message.text, ...ghostPromptSessionStore.getSnapshot().recentSentPrompts].slice(
    0,
    5,
  );
  ghostPromptSessionStore.patchState({
    lastSentPrompt: message.text,
    recentSentPrompts: recent,
    pendingSuggestion: '',
    draftText: '',
  });
  await appendLog(dataUri, message.text);
  broadcastClearAll();
}

/**
 * Enruta un mensaje inbound del webview al handler correspondiente.
 * @param {WebviewInboundMessage} message Mensaje entrante parseado desde el webview.
 * @param {GhostPromptInboundDispatchServices} services Servicios de despacho y broadcasting.
 * @return {Promise<void>} Promise que se resuelve cuando el mensaje se procesa.
 */
export async function dispatchGhostPromptInboundMessage(
  message: WebviewInboundMessage,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  const dispatchServices = services satisfies GhostPromptInboundDispatchServices;
  logDebugInfo(`Dispatching inbound webview message type=${message.type}`);
  switch (message.type) {
    case 'init':
      await handleGhostPromptInboundInit(dispatchServices.webview, dispatchServices.postSettings);
      return;
    case 'draftChanged':
      handleGhostPromptInboundDraftChanged(message, dispatchServices);
      return;
    case 'updateSetting':
      await handleGhostPromptInboundUpdateSetting(
        message,
        dispatchServices.broadcastSettingsToAllViews,
        dispatchServices,
      );
      return;
    case 'suggest':
      if (getGhostPromptAgentDestination() === 'vsOpenCodeX') {
        return;
      }
      await handleGhostPromptSuggest(message, dispatchServices.suggestDeps);
      return;
    case 'accept':
      await handleGhostPromptInboundAccept(message, dispatchServices.dataUri);
      return;
    case 'send':
      await handleGhostPromptInboundSend(
        message,
        dispatchServices.dataUri,
        dispatchServices.broadcastClearAll,
      );
      return;
    case 'requestProviderStatus':
      await handleProviderStatusRequest(dispatchServices.webview, dispatchServices);
      return;
    case 'startProvider':
      await providerStatusManager.start(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    case 'stopProvider':
      await providerStatusManager.stop(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    default: {
      const _exhaustiveCheck: never = message;
      void _exhaustiveCheck;
    }
  }
}

/**
 * Solicita y publica el estado de los providers al webview.
 * @param {vscode.Webview} webview Webview objetivo del mensaje de status.
 * @param {GhostPromptInboundDispatchServices} services Servicios de dispatch necesarios.
 * @return {Promise<void>} Promise que se resuelve cuando el status se envía.
 */
async function handleProviderStatusRequest(
  webview: vscode.Webview,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  await postProviderStatus(webview, services);
}

/**
 * Publica el estado actualizado de providers al webview y a las vistas relacionadas.
 * @param {vscode.Webview} webview Webview que recibe el mensaje de estado.
 * @param {GhostPromptInboundDispatchServices} services Servicios de broadcast y dispatch.
 * @return {Promise<void>} Promise que se resuelve cuando el mensaje se disparó.
 */
async function postProviderStatus(
  webview: vscode.Webview,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  const providers = await providerStatusManager.refreshAll();
  const msg = { type: 'providerStatus' as const, providers };
  const validated = parseWebviewOutboundMessage(msg);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
  services.broadcastUi(validated);
}
