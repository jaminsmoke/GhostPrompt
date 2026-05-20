/**
 * @file Ensamblaje del hook useGhostPrompt (estado + queries + handlers).
 */
import { postToHost } from './ghostPromptPostMessage';
import { useGhostPromptDerived } from './useGhostPromptDerived';
import { useGhostPromptHandlers } from './useGhostPromptHandlers';

export type { GhostPromptUiState } from './ghostPromptUiState';
export { useGhostPromptUiState } from './ghostPromptUiState';
export { useGhostPromptProviderQueries } from './useGhostPromptProviderQueries';

import type { GhostPromptUiState } from './ghostPromptUiState';
import type { CompletionSourceStateRecord } from '../types';
import type { useQueryClient } from '@tanstack/react-query';

interface GhostPromptRuntimeInput {
  ui: GhostPromptUiState;
  queryClient: ReturnType<typeof useQueryClient>;
  providerStatuses: CompletionSourceStateRecord[];
  statusLoading: boolean;
  mutateStartProvider: (provider: string) => void;
  mutateStopProvider: (provider: string) => void;
}

/**
 * Conecta estado, consultas y handlers del webview GhostPrompt.
 * @param {GhostPromptRuntimeInput} input - Estado UI y dependencias de query.
 * @returns {object} API expuesta por useGhostPrompt.
 */
export function useGhostPromptRuntime(input: GhostPromptRuntimeInput) {
  const { ui, queryClient, providerStatuses, statusLoading, mutateStartProvider, mutateStopProvider } =
    input;

  const derived = useGhostPromptDerived({ ui, providerStatuses });
  const {
    textareaRef,
    handleCursorCheck,
    handleTextChange,
    handleSend,
    handleCompletionProviderChange,
    handleAgentDestinationChange,
    handleSelectedModelChange,
    handleDebugToggle,
    startProvider,
    stopProvider,
  } = useGhostPromptHandlers({
    ui,
    queryClient,
    isGhostUiAllowed: derived.isGhostUiAllowed,
    requestSuggestion: derived.requestSuggestion,
    sendUpdateSetting: derived.sendUpdateSetting,
    mutateStartProvider,
    mutateStopProvider,
  });

  const {
    viewId,
    capabilities,
    text,
    suggestion,
    status,
    suggestionDebounceMs,
    agentDestination,
    vsxActive,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    maxSuggestionChars,
    debugSuggestions,
    isLoading,
    isConfigLoaded,
    setStatus,
  } = ui;

  return {
    viewId,
    capabilities,
    text,
    suggestion,
    status,
    suggestionDebounceMs,
    agentDestination,
    vsxActive,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    maxSuggestionChars,
    debugSuggestions,
    isLoading,
    isConfigLoaded,
    displayStatus: derived.displayStatus,
    providerStatuses,
    statusLoading,
    canSend: derived.canSend,
    isGhostUiAllowed: derived.isGhostUiAllowed,
    acceptSuggestion: derived.acceptSuggestion,
    makeToggle: derived.makeToggle,
    previewMaxSuggestionChars: derived.previewMaxSuggestionChars,
    commitMaxSuggestionChars: derived.commitMaxSuggestionChars,
    setStatus,
    postToHost,
    textareaRef,
    handleCursorCheck,
    handleTextChange,
    handleSend,
    handleCompletionProviderChange,
    handleAgentDestinationChange,
    handleSelectedModelChange,
    handleDebugToggle,
    startProvider,
    stopProvider,
  };
}
