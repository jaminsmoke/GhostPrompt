/**
 * @file Superficie chat (sidebar): prompt, overlay ghost, envío y chip Destino.
 */
import { BottomBar } from '../../components/BottomBar';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { GhostToolbar } from '../../components/GhostToolbar';
import { PromptInput } from '../../components/PromptInput';
import { useGhostPrompt } from '../../hooks/useGhostPrompt';

/**
 * Webview GhostPrompt orientado al chat (Activity Bar).
 * @returns {import('react').JSX.Element} UI de chat.
 */
export function ChatApp() {
  const {
    text,
    suggestion,
    capabilities,
    isLoading,
    vsxActive,
    vsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    textareaRef,
    isGhostUiAllowed,
    canSend,
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
    displayStatus,
    handleTextChange,
    handleSend,
    handleCursorCheck,
    acceptSuggestion,
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
        surface="chat"
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

      {vsxActive && 
        <p
          id="gp-vsx-surface-note"
          className="rounded-md border border-(--vscode-widget-border) bg-(--vscode-textBlockQuote-background) px-3 py-2 mb-2 text-sm text-(--vscode-sideBar-foreground)"
          role="status"
        >
          El chat inline está desactivado: el destino del agente es VSOpenCodeX. Usa el chat de
          VSOpenCodeX para redactar y enviar; las sugerencias siguen el modelo y chips configurados
          aquí.
        </p>
      }

      <PromptInput
        compact={compact}
        text={text}
        suggestion={suggestion}
        vsxActive={vsxActive}
        textareaRef={textareaRef}
        isGhostUiAllowed={isGhostUiAllowed}
        onTextChange={handleTextChange}
        onSend={handleSend}
        onAccept={acceptSuggestion}
        onCursorCheck={handleCursorCheck}
      />

      <BottomBar
        status={displayStatus}
        isLoading={isLoading}
        canSend={canSend}
        onSend={handleSend}
      />
    </ErrorBoundary>
  );
}
