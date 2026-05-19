/**
 * @file Handlers de UI del hook useGhostPrompt.
 */
import { useCallback, type ChangeEvent } from 'react';

import { bumpDraftCaptureGeneration } from './ghostPromptInboundUtilities';
import { logToHost } from './ghostPromptLog';
import { postToHost } from './ghostPromptPostMessage';
import { useGhostPromptEffects } from './useGhostPromptEffects';

import type { GhostPromptUiState } from './ghostPromptUiState';
import type {
  AgentDestination,
  CompletionProvider,
  CompletionSourceStateRecord,
  UpdateSettingMessage,
} from '../types';
import type { useQueryClient } from '@tanstack/react-query';

interface GhostPromptHandlersInput {
  ui: GhostPromptUiState;
  queryClient: ReturnType<typeof useQueryClient>;
  isGhostUiAllowed: () => boolean;
  requestSuggestion: (draftText: string) => void;
  sendUpdateSetting: (message: UpdateSettingMessage) => void;
  mutateStartProvider: (provider: string) => void;
  mutateStopProvider: (provider: string) => void;
}

/**
 * Handlers de interacción del textarea y controles de settings.
 * @param {GhostPromptHandlersInput} input - Estado y dependencias del webview.
 * @returns {object} Callbacks expuestos al componente raíz.
 */
export function useGhostPromptHandlers(input: GhostPromptHandlersInput) {
  const {
    ui,
    queryClient,
    isGhostUiAllowed,
    requestSuggestion,
    sendUpdateSetting,
    mutateStartProvider,
    mutateStopProvider,
  } = input;
  const {
    viewId,
    text,
    setText,
    setSuggestion,
    setStatus,
    vsxActive,
    setAgentDestination,
    setVsxActive,
    completionProvider,
    setCompletionProvider,
    setSelectedModelId,
    debugSuggestions,
    setDebugSuggestions,
    skipSuggestionOnDraftSync,
    textareaReference,
    currentCaptureId,
    setIsLoading,
  } = ui;

  const { syncTextareaHeight } = useGhostPromptEffects({
    ui,
    queryClient,
    isGhostUiAllowed,
    requestSuggestion,
  });

  const handleCursorCheck = useCallback(() => {
    if (!isGhostUiAllowed()) {
      setSuggestion('');
    }
  }, [isGhostUiAllowed, setSuggestion]);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const nextText = event.target.value;
      const nextCaptureId = bumpDraftCaptureGeneration(currentCaptureId.current);
      currentCaptureId.current = nextCaptureId;
      logToHost('debug', 'textChange', { length: nextText.length, captureId: nextCaptureId });
      skipSuggestionOnDraftSync.current = false;
      setSuggestion('');
      setIsLoading(false);
      setText(nextText);
      if (viewId) {
        postToHost({ type: 'draftChanged', text: nextText, originViewId: viewId });
      }
      syncTextareaHeight();
    } catch (error) {
      logToHost('error', 'handleTextChangeFailed', { error: String(error) });
      setStatus('Error al procesar el texto');
    }
  };

  const handleSend = () => {
    if (!text.trim() || vsxActive) {
      return;
    }
    postToHost({ type: 'send', text });
    setStatus('Enviando prompt...');
  };

  const handleCompletionProviderChange = (value: CompletionProvider) => {
    setCompletionProvider(value);
    sendUpdateSetting({ type: 'updateSetting', key: 'completionProvider', value });
    if (value === 'ollama') {
      setSelectedModelId('');
    }
  };

  const handleAgentDestinationChange = (value: AgentDestination) => {
    setAgentDestination(value);
    setVsxActive(value === 'vsOpenCodeX');
    sendUpdateSetting({ type: 'updateSetting', key: 'agentDestination', value });
  };

  const handleSelectedModelChange = (value: string) => {
    setSelectedModelId(value);
    sendUpdateSetting({ type: 'updateSetting', key: 'selectedModelId', value });
    if (completionProvider === 'ollama' && value) {
      queryClient.setQueryData<CompletionSourceStateRecord[]>(['providerStatus'], (old) => {
        return old?.map((entry) => {
          if (entry.id === 'ollama') {
            return { ...entry, status: 'starting' as const, statusText: 'Iniciando…' };
          }
          return entry;
        });
      });
    }
  };

  const handleDebugToggle = () => {
    const next = !debugSuggestions;
    setDebugSuggestions(next);
    sendUpdateSetting({ type: 'updateSetting', key: 'debugSuggestions', value: next });
  };

  const startProvider = useCallback(
    (provider: string) => {
      mutateStartProvider(provider);
    },
    [mutateStartProvider],
  );

  const stopProvider = useCallback(
    (provider: string) => {
      mutateStopProvider(provider);
    },
    [mutateStopProvider],
  );

  return {
    handleCursorCheck,
    handleTextChange,
    handleSend,
    handleCompletionProviderChange,
    handleAgentDestinationChange,
    handleSelectedModelChange,
    handleDebugToggle,
    startProvider,
    stopProvider,
    textareaRef: textareaReference,
  };
}
