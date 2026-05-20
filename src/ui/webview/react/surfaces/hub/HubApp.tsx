/**
 * @file Superficie hub (panel): motor, modelo, longitud, debug y placeholder de estadísticas.
 */
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { GhostToolbar } from '../../components/GhostToolbar';
import { useGhostPrompt } from '../../hooks/useGhostPrompt';

/**
 * Webview GhostPrompt orientado al hub de ajustes (panel inferior).
 * @returns {import('react').JSX.Element} UI del hub.
 */
export function HubApp() {
  const {
    capabilities,
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    maxSuggestionChars,
    previewMaxSuggestionChars,
    commitMaxSuggestionChars,
    debugSuggestions,
    isConfigLoaded,
    agentDestination,
    providerStatuses,
    statusLoading,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    handleCompletionProviderChange,
    handleSelectedModelChange,
    handleAgentDestinationChange,
    handleDebugToggle,
    makeToggle,
    startProvider,
    stopProvider,
  } = useGhostPrompt();

  const compact = capabilities.compactToolbar === true;

  if (!isConfigLoaded) {
    return (
      <ErrorBoundary>
        <div className="p-4 text-sm opacity-70" style={{ color: 'var(--vscode-foreground,#cccccc)' }}>
          Cargando configuración…
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GhostToolbar
        surface="hub"
        compact={compact}
        completionProvider={completionProvider}
        selectedModelId={selectedModelId}
        availableModels={availableModels}
        suggestionModelPolicy={suggestionModelPolicy}
        maxSuggestionChars={maxSuggestionChars}
        onPreviewMaxSuggestionChars={previewMaxSuggestionChars}
        onCommitMaxSuggestionChars={commitMaxSuggestionChars}
        debugSuggestions={debugSuggestions}
        agentDestination={agentDestination}
        vsOpenCodeXExtensionInstalled={vsOpenCodeXExtensionInstalled}
        cursorDesktopHost={cursorDesktopHost}
        providerStatuses={providerStatuses}
        statusLoading={statusLoading}
        onCompletionProviderChange={handleCompletionProviderChange}
        onSelectedModelChange={handleSelectedModelChange}
        onAgentDestinationChange={handleAgentDestinationChange}
        onToggle={makeToggle}
        onDebugToggle={handleDebugToggle}
        onStartProvider={startProvider}
        onStopProvider={stopProvider}
      />

      <section
        id="gp-hub-stats"
        aria-labelledby="gp-hub-stats-heading"
        className="mt-4 rounded-md border border-(--vscode-widget-border) bg-(--vscode-editorWidget-background) px-3 py-3 text-sm text-(--vscode-sideBar-foreground)"
      >
        <h2 id="gp-hub-stats-heading" className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide opacity-80">
          Estadísticas
        </h2>
        <p className="m-0 text-xs text-(--vscode-descriptionForeground)">
          Próximamente: métricas de uso y rendimiento del hub GhostPrompt.
        </p>
      </section>
    </ErrorBoundary>
  );
}
