import type { AgentDestination, CompletionProvider, SuggestionModel, UpdateSettingMessage } from "../types";

interface GhostToolbarProps {
  completionProvider: CompletionProvider;
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionModelPolicy: "nonPremiumOnly" | "anyModel";
  suggestionStyle: "concise" | "balanced" | "detailed";
  contextMode: "off" | "basic" | "project";
  suggestionLanguageChoice: "auto" | "es" | "en";
  debugSuggestions: boolean;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
  compact: boolean;
  onCompletionProviderChange: (value: CompletionProvider) => void;
  onSelectedModelChange: (value: string) => void;
  onAgentDestinationChange: (value: AgentDestination) => void;
  onToggle: <K extends UpdateSettingMessage["key"]>(
    key: K,
    value: Extract<UpdateSettingMessage, { key: K }>["value"],
  ) => void;
  onDebugToggle: () => void;
}

const toggleBtn = (active: boolean, compact: boolean) =>
  `inline-flex items-center justify-center rounded-md border px-${compact ? "2" : "3"} py-${compact ? "1" : "1.5"} text-${compact ? "xs" : "sm"} transition focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)] ${
    active
      ? "border-[var(--vscode-badge-background)] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
      : "border-[var(--vscode-widget-border)] text-[var(--vscode-sideBar-foreground)] hover:border-[var(--vscode-input-border)] hover:bg-[var(--vscode-list-hoverBackground)]"
  }`;

const selectClass =
  "rounded-md border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-sm text-[var(--vscode-input-foreground)] outline-none ring-1 ring-transparent transition focus:border-[var(--vscode-focusBorder)] focus:ring-[var(--vscode-focusBorder)]";

export function GhostToolbar({
  completionProvider,
  selectedModelId,
  availableModels,
  suggestionModelPolicy,
  suggestionStyle,
  contextMode,
  suggestionLanguageChoice,
  debugSuggestions,
  agentDestination,
  vsOpenCodeXExtensionInstalled,
  compact,
  onCompletionProviderChange,
  onSelectedModelChange,
  onAgentDestinationChange,
  onToggle,
  onDebugToggle,
}: GhostToolbarProps) {
  const labelClass = compact
    ? "text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vscode-descriptionForeground)]"
    : "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vscode-descriptionForeground)]";

  return (
    <div className={`flex flex-wrap gap-${compact ? "1" : "2"} mb-${compact ? "2" : "3"}`}>
      <div className="flex flex-col gap-1" data-key="completionProvider">
        <span className={labelClass}>Motor</span>
        <select
          id="completion-backend-select"
          className={selectClass}
          value={completionProvider}
          onChange={(e) => onCompletionProviderChange(e.target.value as CompletionProvider)}
          aria-label="Motor de suggestions (Copilot LM u OpenCode)"
        >
          <option value="copilot">Copilot LM</option>
          <option value="opencode">OpenCode</option>
          <option value="ollama">Ollama</option>
        </select>
      </div>

      {vsOpenCodeXExtensionInstalled ? (
        <div className="flex flex-col gap-1" data-key="agentDestination">
          <span className={labelClass}>Destino</span>
          <select
            id="agent-destination-select"
            className={selectClass}
            value={agentDestination}
            onChange={(e) => onAgentDestinationChange(e.target.value as AgentDestination)}
            aria-label="Destino del prompt (Copilot Chat o VSOpenCodeX)"
          >
            <option value="copilotChat">Copilot Chat</option>
            <option value="vsOpenCodeX">VSOpenCodeX</option>
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1" data-key="suggestionModelPolicy">
        <span className={labelClass}>Modelo</span>
        <div className="flex gap-1">
          <button
            type="button"
            className={toggleBtn(suggestionModelPolicy === "nonPremiumOnly", compact)}
            onClick={() => onToggle("suggestionModelPolicy", "nonPremiumOnly")}
            aria-pressed={suggestionModelPolicy === "nonPremiumOnly"}
          >
            No premium
          </button>
          <button
            type="button"
            className={toggleBtn(suggestionModelPolicy === "anyModel", compact)}
            onClick={() => onToggle("suggestionModelPolicy", "anyModel")}
            aria-pressed={suggestionModelPolicy === "anyModel"}
          >
            Cualquiera
          </button>
        </div>
        <select
          id="model-select"
          className={selectClass}
          aria-label="Modelo sugerencias"
          value={selectedModelId}
          onChange={(e) => onSelectedModelChange(e.target.value)}
        >
          <option value="auto">Auto</option>
          {availableModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
        <span
          id="model-runtime-label"
          className="inline-flex items-center justify-center rounded-md border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-descriptionForeground)]"
          aria-live="polite"
        >
          {availableModels.find((m) => m.id === selectedModelId)?.label ?? "--"}
        </span>
      </div>

      <details
        className="rounded-md border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)]"
        id="compose-options-details"
      >
        <summary
          className="w-full rounded-md border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-left text-sm font-medium text-[var(--vscode-sideBar-foreground)]"
          aria-label="Opciones de composición: estilo, contexto e idioma"
        >
          Normal · Básico · Auto
        </summary>
        <div className={`grid gap-${compact ? "1" : "2"} p-2`} role="group" aria-label="Estilo, contexto e idioma">
          <div className="flex flex-col gap-1" data-key="suggestionStyle">
            <span className={labelClass}>Estilo</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "concise", compact)}
                onClick={() => onToggle("suggestionStyle", "concise")}
                aria-pressed={suggestionStyle === "concise"}
              >
                Breve
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "balanced", compact)}
                onClick={() => onToggle("suggestionStyle", "balanced")}
                aria-pressed={suggestionStyle === "balanced"}
              >
                Normal
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "detailed", compact)}
                onClick={() => onToggle("suggestionStyle", "detailed")}
                aria-pressed={suggestionStyle === "detailed"}
              >
                Extenso
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1" data-key="contextMode">
            <span className={labelClass}>Contexto</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(contextMode === "basic", compact)}
                onClick={() => onToggle("contextMode", "basic")}
                aria-pressed={contextMode === "basic"}
              >
                Básico
              </button>
              <button
                type="button"
                className={toggleBtn(contextMode === "project", compact)}
                onClick={() => onToggle("contextMode", "project")}
                aria-pressed={contextMode === "project"}
              >
                Proyecto
              </button>
              <button
                type="button"
                className={toggleBtn(contextMode === "off", compact)}
                onClick={() => onToggle("contextMode", "off")}
                aria-pressed={contextMode === "off"}
              >
                Off
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1" data-key="suggestionLanguageChoice">
            <span className={labelClass}>Idioma</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "auto", compact)}
                onClick={() => onToggle("suggestionLanguageChoice", "auto")}
                aria-pressed={suggestionLanguageChoice === "auto"}
              >
                Auto
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "es", compact)}
                onClick={() => onToggle("suggestionLanguageChoice", "es")}
                aria-pressed={suggestionLanguageChoice === "es"}
              >
                ES
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "en", compact)}
                onClick={() => onToggle("suggestionLanguageChoice", "en")}
                aria-pressed={suggestionLanguageChoice === "en"}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </details>

      <button
        type="button"
        id="debug-btn"
        className={toggleBtn(debugSuggestions, compact)}
        aria-pressed={debugSuggestions}
        onClick={onDebugToggle}
      >
        {debugSuggestions ? "Debug: on" : "Debug: off"}
      </button>
    </div>
  );
}
