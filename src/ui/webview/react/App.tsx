import "./index.css";
import { useGhostPrompt } from "./hooks/useGhostPrompt";
import { GhostToolbar } from "./components/GhostToolbar";
import { PromptInput } from "./components/PromptInput";
import { BottomBar } from "./components/BottomBar";
import { ErrorBoundary } from "./components/ErrorBoundary";

export { postToHost } from "./hooks/useGhostPrompt";

/**
 * Componente raíz del webview React de GhostPrompt.
 * @returns Elemento raíz del webview.
 */
export function App(): JSX.Element {
  const {
    text,
    suggestion,
    capabilities,
    isLoading,
    vsxActive,
    vsOpenCodeXExtensionInstalled,
    textareaRef,
    isGhostUiAllowed,
    canSend,
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    suggestionStyle,
    suggestionLanguageChoice,
    debugSuggestions,
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

  return (
    <ErrorBoundary>
      <GhostToolbar
        compact={compact}
        completionProvider={completionProvider}
        selectedModelId={selectedModelId}
        availableModels={availableModels}
        suggestionModelPolicy={suggestionModelPolicy}
        suggestionStyle={suggestionStyle}
        suggestionLanguageChoice={suggestionLanguageChoice}
        debugSuggestions={debugSuggestions}
        agentDestination={agentDestination}
        vsOpenCodeXExtensionInstalled={vsOpenCodeXExtensionInstalled}
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

      {vsxActive ? (
        <p
          id="gp-vsx-surface-note"
          className="rounded-md border border-[var(--vscode-widget-border)] bg-[var(--vscode-textBlockQuote-background)] px-3 py-2 mb-2 text-sm text-[var(--vscode-sideBar-foreground)]"
          role="status"
        >
          El chat inline está desactivado: el destino del agente es VSOpenCodeX. Usa el chat de VSOpenCodeX para redactar y enviar; las sugerencias siguen el modelo y chips configurados aquí.
        </p>
      ) : null}

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
