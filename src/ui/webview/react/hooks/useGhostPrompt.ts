/**
 * @file Hook React para el estado y comunicación del webview GhostPrompt.
 */
export {
  applyRemoteDraftRelay,
  bumpDraftCaptureGeneration,
  ghostPromptApplyInboundCaptureReference,
  isDraftSyncForAnotherView,
  shouldSkipSuggestionOnRemoteDraft,
} from './ghostPromptInboundUtilities';
export type { GhostPromptInboundCaptureCarrier } from './ghostPromptInboundUtilities';

export { postToHost } from './ghostPromptPostMessage';

import {
  useGhostPromptProviderQueries,
  useGhostPromptRuntime,
  useGhostPromptUiState,
} from './useGhostPromptRuntime';

/**
 * Hook principal de GhostPrompt para el webview React.
 * Gestiona estado local, comunicación con el host y sugerencias.
 * @returns {object} API y estado de GhostPrompt para el componente.
 */
export function useGhostPrompt() {
  const ui = useGhostPromptUiState();
  const {
    queryClient,
    providerStatuses,
    statusLoading,
    mutateStartProvider,
    mutateStopProvider,
  } = useGhostPromptProviderQueries();

  return useGhostPromptRuntime({
    ui,
    queryClient,
    providerStatuses,
    statusLoading,
    mutateStartProvider,
    mutateStopProvider,
  });
}
