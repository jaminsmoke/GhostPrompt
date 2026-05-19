/**
 * @file Despacho de mensajes inbound del host hacia el estado del webview GhostPrompt.
 */
import { parseWebviewInboundMessage } from '../validators/parseWebviewInbound';
import {
  DEFAULT_SUGGESTION_DEBOUNCE_MS,
  MIN_SUGGESTION_DEBOUNCE_MS,
  WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS,
} from '../webviewProtocolConstants';

import {
  applyRemoteDraftRelay,
  ghostPromptApplyInboundCaptureReference,
  shouldSkipSuggestionOnRemoteDraft,
  type GhostPromptInboundCaptureCarrier,
} from './ghostPromptInboundUtilities';

import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceStateRecord,
  InboundMessage,
  SuggestionModel,
} from '../types';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';

export type GhostPromptInboundHandlerContext = {
  viewId: string;
  queryClient: QueryClient;
  getCaptureId: () => number;
  setCaptureId: (value: number) => void;
  armSkipSuggestionOnDraftRelay: () => void;
  setCompletionProvider: Dispatch<SetStateAction<CompletionProvider>>;
  setSelectedModelId: Dispatch<SetStateAction<string>>;
  setAvailableModels: Dispatch<SetStateAction<SuggestionModel[]>>;
  setSuggestionModelPolicy: Dispatch<SetStateAction<'anyModel' | 'nonPremiumOnly'>>;
  setSuggestionStyle: Dispatch<SetStateAction<'balanced' | 'concise' | 'detailed'>>;
  setSuggestionDebounceMs: Dispatch<SetStateAction<number>>;
  setDebugSuggestions: Dispatch<SetStateAction<boolean>>;
  setAgentDestination: Dispatch<SetStateAction<AgentDestination>>;
  setVsOpenCodeXExtensionInstalled: Dispatch<SetStateAction<boolean>>;
  setCursorDesktopHost: Dispatch<SetStateAction<boolean>>;
  setVsxActive: Dispatch<SetStateAction<boolean>>;
  setSuggestion: Dispatch<SetStateAction<string>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsConfigLoaded: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
  logToHost: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
    captureId?: number,
  ) => void;
};

/**
 * Aplica el mensaje `settings` del host al estado del webview.
 * @param {Extract<InboundMessage, { type: 'settings' }>} message - Mensaje de settings del host.
 * @param {GhostPromptInboundHandlerContext} handler - Setters del hook webview.
 * @returns {void}
 */
function applyGhostPromptSettingsMessage(
  message: Extract<InboundMessage, { type: 'settings' }>,
  handler: GhostPromptInboundHandlerContext,
): void {
  const { settings } = message;
  handler.setCompletionProvider(settings.completionProvider);
  handler.setSelectedModelId(settings.selectedModelId);
  handler.setAvailableModels(settings.availableModels);
  handler.setSuggestionModelPolicy(settings.suggestionModelPolicy);
  handler.setSuggestionStyle(settings.suggestionStyle);
  handler.setSuggestionDebounceMs(settings.suggestionDebounceMs);
  if (settings.suggestionDebounceMs < MIN_SUGGESTION_DEBOUNCE_MS) {
    handler.logToHost('warn', 'invalidSuggestionDebounce', {
      suggestionDebounceMs: settings.suggestionDebounceMs,
    });
    handler.setSuggestionDebounceMs(DEFAULT_SUGGESTION_DEBOUNCE_MS);
  }
  handler.setDebugSuggestions(settings.debugSuggestions);
  handler.setAgentDestination(settings.agentDestination);
  handler.setVsOpenCodeXExtensionInstalled(settings.vsOpenCodeXExtensionInstalled);
  handler.setCursorDesktopHost(settings.cursorDesktopHost);
  handler.setVsxActive(settings.agentDestination === 'vsOpenCodeX');
  handler.setIsConfigLoaded(true);
  if (settings.agentDestination === 'vsOpenCodeX') {
    handler.setStatus('Destino VSOpenCodeX: usa VSOpenCodeX para enviar prompts.');
    handler.setSuggestion('');
  } else {
    handler.setStatus('Empieza a escribir para obtener sugerencias...');
  }
}

/**
 * Aplica mensajes de resultado de sugerencia del host.
 * @param {InboundMessage} message - Mensaje parseado del host.
 * @param {GhostPromptInboundHandlerContext} handler - Estado y callbacks del hook.
 * @returns {void}
 */
function applyGhostPromptSuggestionInbound(
  message: Extract<
    InboundMessage,
    { type: 'suggestion' | 'suggestion-stream' | 'empty' | 'loading' | 'error' }
  >,
  handler: GhostPromptInboundHandlerContext,
): void {
  switch (message.type) {
    case 'suggestion': {
      handler.logToHost('debug', 'suggestionInbound', {
        chars: message.suggestion.length,
        preview: message.suggestion.slice(0, WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS),
        captureId: message.captureId,
      });
      handler.setSuggestion(message.suggestion);
      handler.setIsLoading(false);
      handler.setStatus('Suggestion recibida. Presiona Tab para aceptar o Envía para enviar.');
      break;
    }
    case 'suggestion-stream': {
      if (message.text) {
        handler.setSuggestion(message.text);
        handler.setStatus('Suggestion en progreso...');
      }
      break;
    }
    case 'empty': {
      handler.setSuggestion('');
      handler.setIsLoading(false);
      handler.setStatus('No hay suggestion disponible.');
      break;
    }
    case 'loading': {
      const label =
        typeof message.statusText === 'string' && message.statusText.trim().length > 0
          ? message.statusText
          : 'Buscando sugerencia...';
      handler.setStatus(label);
      handler.setIsLoading(true);
      break;
    }
    case 'error': {
      handler.setSuggestion('');
      handler.setIsLoading(false);
      handler.setStatus(`Error: ${message.message}`);
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Aplica mensajes de borrador y estado de proveedores.
 * @param {InboundMessage} message - Mensaje parseado del host.
 * @param {GhostPromptInboundHandlerContext} handler - Estado y callbacks del hook.
 * @returns {void}
 */
function applyGhostPromptDraftAndProviderInbound(
  message: Extract<
    InboundMessage,
    { type: 'clear' | 'draftHydrate' | 'draftSync' | 'providerStatus' }
  >,
  handler: GhostPromptInboundHandlerContext,
): void {
  switch (message.type) {
    case 'clear': {
      handler.setText('');
      handler.setSuggestion('');
      handler.setStatus('Prompt enviado. Escribe otro texto...');
      break;
    }
    case 'draftHydrate': {
      applyRemoteDraftRelay(message.text, handler);
      break;
    }
    case 'draftSync': {
      if (!shouldSkipSuggestionOnRemoteDraft(message, handler.viewId)) {
        return;
      }
      applyRemoteDraftRelay(message.text, handler);
      break;
    }
    case 'providerStatus': {
      handler.queryClient.setQueryData<CompletionSourceStateRecord[]>(
        ['providerStatus'],
        message.providers,
      );
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Enruta un mensaje inbound ya validado al handler de su tipo.
 * @param {InboundMessage} message - Mensaje parseado del host.
 * @param {GhostPromptInboundHandlerContext} handler - Estado y callbacks del hook.
 * @returns {void}
 */
function routeGhostPromptInboundMessage(
  message: InboundMessage,
  handler: GhostPromptInboundHandlerContext,
): void {
  if (message.type === 'settings') {
    applyGhostPromptSettingsMessage(message, handler);
    return;
  }
  if (
    message.type === 'suggestion' ||
    message.type === 'suggestion-stream' ||
    message.type === 'empty' ||
    message.type === 'loading' ||
    message.type === 'error'
  ) {
    applyGhostPromptSuggestionInbound(message, handler);
    return;
  }
  applyGhostPromptDraftAndProviderInbound(message, handler);
}

/**
 * Procesa un mensaje `postMessage` del host de extensión.
 * @param {MessageEvent} event - Evento de mensaje del webview.
 * @param {GhostPromptInboundHandlerContext} handler - Estado y callbacks del hook.
 * @returns {void}
 */
export function handleGhostPromptInboundMessage(
  event: MessageEvent,
  handler: GhostPromptInboundHandlerContext,
): void {
  try {
    const message = parseWebviewInboundMessage(event.data);
    if (!message) {
      handler.logToHost('warn', 'invalidInboundMessage', { raw: event.data });
      return;
    }

    const { refAfter, drop } = ghostPromptApplyInboundCaptureReference(
      handler.getCaptureId(),
      message as GhostPromptInboundCaptureCarrier,
    );
    handler.setCaptureId(refAfter);
    if (drop) {
      return;
    }

    handler.logToHost('debug', 'inboundMessage', {
      type: message.type,
      ...'captureId' in message ? { captureId: message.captureId } : {},
    });

    routeGhostPromptInboundMessage(message, handler);
  } catch (error) {
    handler.logToHost('error', 'handleMessageFailed', { error: String(error) });
    handler.setStatus('Error interno al procesar mensaje del host');
  }
}
