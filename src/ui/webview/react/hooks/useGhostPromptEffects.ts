/**
 * @file Efectos del webview GhostPrompt (inbound, debounce, textarea).
 * Almacena mensajes entrantes antes de que React monte el listener.
 */
import { useCallback, useEffect } from 'react';

import { WEBVIEW_TEXTAREA_MIN_HEIGHT_PX } from '../../../../system/internals/protocols/constants/consPipelineDefaults';

import { logToHost } from './ghostPromptLog';
import { postToHost } from './ghostPromptPostMessage';
import {
  handleGhostPromptInboundMessage,
  type GhostPromptInboundHandlerContext,
} from './handleGhostPromptInboundMessage';

import type { GhostPromptUiState } from './ghostPromptUiState';
import type { useQueryClient } from '@tanstack/react-query';

interface GhostPromptInboundEffectInput {
  ui: GhostPromptUiState;
  queryClient: ReturnType<typeof useQueryClient>;
}

/**
 * Suscripción a mensajes inbound del host y efecto de debounce de sugerencias.
 * @param {object} input - Contexto de efectos (inbound + debounce).
 * @returns {{ syncTextareaHeight: () => void }} Utilidad para sincronizar altura del textarea.
 */
const preMountBuffer: unknown[] = [];
let preMountInstalled = false;
function handlePreMountMessage(event: MessageEvent): void {
  preMountBuffer.push(event.data);
}
function installPreMountBuffer(): void {
  if (preMountInstalled) return;
  preMountInstalled = true;
  window.addEventListener('message', handlePreMountMessage);
}
if (typeof window?.addEventListener === 'function') {
  installPreMountBuffer();
}

export function useGhostPromptEffects(
  input: GhostPromptInboundEffectInput & {
    isGhostUiAllowed: () => boolean;
    requestSuggestion: (draftText: string) => void;
  },
): { syncTextareaHeight: () => void } {
  const { ui, queryClient, isGhostUiAllowed, requestSuggestion } = input;
  const {
    viewId,
    suggestionDebounceMs,
    text,
    setAgentDestination,
    setAvailableModels,
    setCompletionProvider,
    setCursorDesktopHost,
    setDebugSuggestions,
    setIsLoading,
    setIsConfigLoaded,
    setSelectedModelId,
    setStatus,
    setSuggestion,
    setSuggestionDebounceMs,
    setSuggestionModelPolicy,
    setSuggestionStyle,
    setText,
    setVsOpenCodeXExtensionInstalled,
    setVsxActive,
    currentCaptureId,
    debounceTimer,
    skipSuggestionOnDraftSync,
    textareaReference,
  } = ui;

  useEffect(() => {
    const inboundContext: GhostPromptInboundHandlerContext = {
      viewId,
      queryClient,
      getCaptureId: () => currentCaptureId.current,
      setCaptureId: (value) => {
        currentCaptureId.current = value;
      },
      armSkipSuggestionOnDraftRelay: () => {
        skipSuggestionOnDraftSync.current = true;
      },
      setCompletionProvider,
      setSelectedModelId,
      setAvailableModels,
      setSuggestionModelPolicy,
      setSuggestionStyle,
      setSuggestionDebounceMs,
      setDebugSuggestions,
      setAgentDestination,
      setVsOpenCodeXExtensionInstalled,
      setCursorDesktopHost,
      setVsxActive,
      setSuggestion,
      setIsLoading,
      setIsConfigLoaded,
      setStatus,
      setText,
      logToHost,
    };
    const handleMessage = (event: MessageEvent) =>
      handleGhostPromptInboundMessage(event, inboundContext);

    window.addEventListener('message', handleMessage);
    while (preMountBuffer.length > 0) {
      const bufferedData = preMountBuffer.shift()!;
      handleGhostPromptInboundMessage({ data: bufferedData } as MessageEvent, inboundContext);
    }
    postToHost({ type: 'init' });

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('message', handlePreMountMessage);
    };
  }, [
    viewId,
    queryClient,
    currentCaptureId,
    skipSuggestionOnDraftSync,
    setAgentDestination,
    setAvailableModels,
    setCompletionProvider,
    setCursorDesktopHost,
    setDebugSuggestions,
    setIsLoading,
    setIsConfigLoaded,
    setSelectedModelId,
    setStatus,
    setSuggestion,
    setSuggestionDebounceMs,
    setSuggestionModelPolicy,
    setSuggestionStyle,
    setText,
    setVsOpenCodeXExtensionInstalled,
    setVsxActive,
  ]);

  useEffect(() => {
    if (debounceTimer.current !== false) {
      globalThis.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = globalThis.setTimeout(() => {
      if (skipSuggestionOnDraftSync.current) {
        skipSuggestionOnDraftSync.current = false;
        return;
      }
      if (!isGhostUiAllowed()) {
        return;
      }
      requestSuggestion(text);
    }, suggestionDebounceMs);
    return () => {
      if (debounceTimer.current !== false) {
        globalThis.clearTimeout(debounceTimer.current);
      }
    };
  }, [
    debounceTimer,
    isGhostUiAllowed,
    requestSuggestion,
    skipSuggestionOnDraftSync,
    suggestionDebounceMs,
    text,
  ]);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaReference.current;
    if (textarea === false) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, WEBVIEW_TEXTAREA_MIN_HEIGHT_PX)}px`;
  }, [textareaReference]);

  useEffect(() => {
    syncTextareaHeight();
  }, [syncTextareaHeight]);

  return { syncTextareaHeight };
}
