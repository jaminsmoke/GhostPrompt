/**
 * @file Handlers por `message.type` del canal webview → host (init, suggest, send, …).
 * Router: `dispatchGhostPromptInboundMessage`. Roadmap v0.3.2 fase A.
 */
import * as vscode from 'vscode';

import {
  getActiveDestinationProvider,
  getAgentDestination,
} from '../../destinations/destinationRegistry';
import { getLogger } from '../../system/log';
import { providerStatusManager } from '../../system/runtime/providerStatusManager';
import { type GhostPromptSuggestDeps, handleGhostPromptSuggest } from '../../system/runtime/suggestRuntime';
import {
  getMultiViewDraftText,
  resetMultiViewDraftText,
  setMultiViewDraftText,
} from '../../ui/provider/multiViewDraft';
import { applyWebviewUpdateSetting } from '../settings/applyWebviewUpdate';

import {
  parseWebviewOutboundMessage,
  type WebviewInboundMessage,
} from './webviewProtocols';

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
  /** Hook para efectos secundarios de cambio de modelo/provider (Ollama lifecycle, etc.). */
  onSettingChanged?: (key: 'completionProvider' | 'selectedModelId', value: string) => Promise<void>;
};

/**
 * Inicializa la vista webview y envía el estado inicial a la UI.
 * @param {vscode.Webview} webview - Webview que recibe el mensaje init.
 * @param {(w: vscode.Webview) => Promise<void>} postSettings - Callback para enviar el payload de configuración.
 * @returns {Promise<void>} Promise que se resuelve cuando la inicialización termina.
 */
export async function handleGhostPromptInboundInit(
  webview: vscode.Webview,
  postSettings: (w: vscode.Webview) => Promise<void>,
): Promise<void> {
  await postSettings(webview);
  const draftPayload = {
    type: 'draftHydrate' as const,
    text: getMultiViewDraftText(),
  };
  const validated = parseWebviewOutboundMessage(draftPayload);
  if (!validated) {
    return;
  }
  webview.postMessage(validated);
}

/**
 * Maneja actualizaciones del borrador desde la UI del webview.
 * @param {WebviewInboundMessage} message - Mensaje de tipo draftChanged.
 * @param {object} services - Servicios de broadcast para sincronizar borradores.
 * @returns {void} Void.
 */
export function handleGhostPromptInboundDraftChanged(
  message: Extract<WebviewInboundMessage, { type: 'draftChanged' }>,
  services: Pick<GhostPromptInboundDispatchServices, 'broadcastDraftSync' | 'viewContributionId'>,
): void {
  if (message.originViewId !== services.viewContributionId) {
    return;
  }
  setMultiViewDraftText(message.text);
  services.broadcastDraftSync(message.originViewId, message.text);
}

/**
 * Aplica un cambio de configuración originado en el webview y notifica a todas
 * las vistas. Efectos secundarios delegados al callback `onSettingChanged` si
 * está presente en los servicios de dispatch.
 * @param {WebviewInboundMessage} message - Mensaje `updateSetting` del webview.
 * @param {() => Promise<void>} broadcastSettingsToAllViews - Callback para re-enviar settings a todas las vistas.
 * @param {GhostPromptInboundDispatchServices | undefined} [dispatchServices] - Servicios de dispatch opcionales.
 * @returns {Promise<void>} Promise que se resuelve cuando la actualización termina.
 */
export async function handleGhostPromptInboundUpdateSetting(
  message: Extract<WebviewInboundMessage, { type: 'updateSetting' }>,
  broadcastSettingsToAllViews: () => Promise<void>,
  dispatchServices?: GhostPromptInboundDispatchServices,
): Promise<void> {
  await applyWebviewUpdateSetting(message);
  await broadcastSettingsToAllViews();

  if (
    dispatchServices?.onSettingChanged &&
    (message.key === 'selectedModelId' || message.key === 'completionProvider') &&
    typeof message.value === 'string'
  ) {
    dispatchServices.onSettingChanged(message.key, message.value).catch(() => {
      /* best-effort refresh */
    });
  }
}

/**
 * Maneja la aceptación de una sugerencia y la guarda en el historial.
 * @param {WebviewInboundMessage} message - Mensaje de tipo accept con la sugerencia seleccionada.
 * @param {vscode.Uri} _dataUri - Ubicación de almacenamiento para el registro de sugerencias.
 * @returns {Promise<void>} Promise que se resuelve cuando la sugerencia se registra.
 */
export function handleGhostPromptInboundAccept(
  message: Extract<WebviewInboundMessage, { type: 'accept' }>,
  _dataUri: vscode.Uri,
): Promise<void> {
  getLogger('inbound').info('suggestion-accepted', {
    context: message.context,
    suggestion: message.suggestion,
  });
  return Promise.resolve();
}

/**
 * Maneja el envío de texto al destino configurado desde el webview.
 * @param {WebviewInboundMessage} message - Mensaje de tipo send con el texto a enviar.
 * @param {vscode.Uri} _dataUri - URI de almacenamiento para registro de envíos.
 * @param {() => void} broadcastClearAll - Callback para limpiar el estado de sugerencia en la UI.
 * @returns {Promise<void>} Promise que se resuelve cuando el envío se procesa.
 */
export async function handleGhostPromptInboundSend(
  message: Extract<WebviewInboundMessage, { type: 'send' }>,
  _dataUri: vscode.Uri,
  broadcastClearAll: () => void,
): Promise<void> {
  if (getAgentDestination() === 'vsOpenCodeX') {
    return;
  }
  if (!message.text) {
    return;
  }
  const provider = getActiveDestinationProvider();
  if (typeof provider.sendPrompt !== 'function') {
    await vscode.window.showErrorMessage(
      `GhostPrompt: destino '${provider.id}' no tiene función de envío registrada.`,
    );
    return;
  }
  try {
    await provider.sendPrompt(message.text);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(
      `GhostPrompt: no se pudo enviar al destino '${provider.id}': ${messageText}`,
    );
    return;
  }
  resetMultiViewDraftText();
  getLogger('inbound').info('prompt-sent', { prompt: message.text });
  broadcastClearAll();
}

/**
 * Registra en el logger del host un mensaje `log` enviado desde el webview.
 * @param {Extract<WebviewInboundMessage, { type: 'log' }>} message - Mensaje de log del webview.
 * @returns {void}
 */
function dispatchGhostPromptLogInbound(
  message: Extract<WebviewInboundMessage, { type: 'log' }>,
): void {
  const log = getLogger('ui');
  const payload = {
    message: message.message,
    data: message.data,
    captureId: message.captureId,
  };
  switch (message.level) {
    case 'debug': {
      log.debug('webview-log', payload);
      break;
    }
    case 'info': {
      log.info('webview-log', payload);
      break;
    }
    case 'warn': {
      log.warn('webview-log', payload);
      break;
    }
    case 'error': {
      log.error('webview-log', payload);
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Publica el estado actualizado de providers al webview y a las vistas relacionadas.
 * @param {vscode.Webview} webview - Webview que recibe el mensaje de estado.
 * @param {GhostPromptInboundDispatchServices} services - Servicios de broadcast y dispatch.
 * @returns {Promise<void>} Promise que se resuelve cuando el mensaje se disparó.
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

/**
 * Solicita y publica el estado de los providers al webview.
 * @param {vscode.Webview} webview - Webview objetivo del mensaje de status.
 * @param {GhostPromptInboundDispatchServices} services - Servicios de dispatch necesarios.
 * @returns {Promise<void>} Promise que se resuelve cuando el status se envía.
 */
async function handleProviderStatusRequest(
  webview: vscode.Webview,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  await postProviderStatus(webview, services);
}

/**
 * Enruta un mensaje inbound del webview al handler correspondiente.
 * @param {WebviewInboundMessage} message - Mensaje entrante parseado desde el webview.
 * @param {GhostPromptInboundDispatchServices} services - Servicios de despacho y broadcasting.
 * @returns {Promise<void>} Promise que se resuelve cuando el mensaje se procesa.
 */
export async function dispatchGhostPromptInboundMessage(
  message: WebviewInboundMessage,
  services: GhostPromptInboundDispatchServices,
): Promise<void> {
  const dispatchServices = services satisfies GhostPromptInboundDispatchServices;
  getLogger('inbound').debug('dispatch', { type: message.type });
  switch (message.type) {
    case 'init': {
      await handleGhostPromptInboundInit(dispatchServices.webview, dispatchServices.postSettings);
      return;
    }
    case 'log': {
      dispatchGhostPromptLogInbound(message);
      return;
    }
    case 'draftChanged': {
      handleGhostPromptInboundDraftChanged(message, dispatchServices);
      return;
    }
    case 'updateSetting': {
      await handleGhostPromptInboundUpdateSetting(
        message,
        dispatchServices.broadcastSettingsToAllViews,
        dispatchServices,
      );
      return;
    }
    case 'suggest': {
      if (getAgentDestination() === 'vsOpenCodeX') {
        return;
      }
      await handleGhostPromptSuggest(message, dispatchServices.suggestDeps);
      return;
    }
    case 'accept': {
      await handleGhostPromptInboundAccept(message, dispatchServices.dataUri);
      return;
    }
    case 'send': {
      await handleGhostPromptInboundSend(
        message,
        dispatchServices.dataUri,
        dispatchServices.broadcastClearAll,
      );
      return;
    }
    case 'requestProviderStatus': {
      await handleProviderStatusRequest(dispatchServices.webview, dispatchServices);
      return;
    }
    case 'startProvider': {
      await providerStatusManager.start(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    }
    case 'stopProvider': {
      await providerStatusManager.stop(message.provider);
      await postProviderStatus(dispatchServices.webview, dispatchServices);
      return;
    }
    default: {
      const unreachable: never = message;
      throw new Error(`Unhandled inbound message: ${String(unreachable)}`);
    }
  }
}
