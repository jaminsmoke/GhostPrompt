import { useState } from "react";
import type { AgentDestination, CompletionProvider, ProviderState, ProviderStateRecord, SuggestionModel, UpdateSettingMessage } from "../types";
import { ToolbarChip } from "./ToolbarChip";

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
  providerStatuses: ProviderStateRecord[];
  onCompletionProviderChange: (value: CompletionProvider) => void;
  onSelectedModelChange: (value: string) => void;
  onAgentDestinationChange: (value: AgentDestination) => void;
  onToggle: <K extends UpdateSettingMessage["key"]>(
    key: K,
    value: Extract<UpdateSettingMessage, { key: K }>["value"],
  ) => void;
  onDebugToggle: () => void;
  onRequestProviderStatus: () => void;
  onStartProvider: (id: string) => void;
  onStopProvider: (id: string) => void;
}

const itemClass =
  "flex w-full items-center justify-between px-3 py-1.5 text-sm text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] transition";

const actionBtnClass =
  "rounded px-2 py-0.5 text-xs font-medium transition border " +
  "border-[var(--vscode-widget-border)] " +
  "hover:bg-[var(--vscode-list-hoverBackground)]";

const statusIcon = (s: ProviderState): string => {
  switch (s) {
    case "running": return "\u25CF";
    case "stopped": return "\u25CB";
    case "starting": return "\u25CB";
    case "unavailable": return "\u2014";
    case "error": return "\u26A0";
  }
};

const statusColor = (s: ProviderState): string => {
  switch (s) {
    case "running": return "text-green-500";
    case "stopped": return "text-gray-400";
    case "starting": return "text-yellow-400";
    case "unavailable": return "text-gray-500";
    case "error": return "text-red-500";
  }
};

const toggleBtn = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs transition ${
    active
      ? "border-[var(--vscode-badge-background)] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
      : "border-[var(--vscode-widget-border)] text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
  }`;

const separatorClass = "my-1 border-t border-[var(--vscode-widget-border)]";

const chipLabelClass = (compact: boolean) =>
  compact ? "text-[10px]" : "text-xs";

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
  providerStatuses,
  onCompletionProviderChange,
  onSelectedModelChange,
  onAgentDestinationChange,
  onToggle,
  onDebugToggle,
  onRequestProviderStatus,
  onStartProvider,
  onStopProvider,
}: GhostToolbarProps) {
  const [openChip, setOpenChip] = useState<string | null>(null);

  const toggleChip = (id: string) => setOpenChip((p) => (p === id ? null : id));
  const closeChips = () => setOpenChip(null);

  const providerLabel = completionProvider === "copilot"
    ? "Copilot LM"
    : completionProvider === "opencode"
      ? "OpenCode"
      : "Ollama";

  const currentProviderStatus = providerStatuses.find((s) =>
    completionProvider === "copilot" ? s.id === "copilot" :
    completionProvider === "opencode" ? s.id === "opencode" : s.id === "ollama",
  );
  const providerLabelWithStatus = currentProviderStatus
    ? `${statusIcon(currentProviderStatus.status)} ${providerLabel}`
    : providerLabel;

  const currentModel = availableModels.find((m) => m.id === selectedModelId);
  const modeloLabel = currentModel?.label ?? (selectedModelId === "auto" ? "Auto" : selectedModelId);

  const styleLabel = suggestionStyle === "concise" ? "Breve" : suggestionStyle === "balanced" ? "Normal" : "Extenso";
  const ctxLabel = contextMode === "basic" ? "Básico" : contextMode === "project" ? "Proyecto" : "Off";
  const langLabel = suggestionLanguageChoice === "auto" ? "Auto" : suggestionLanguageChoice === "es" ? "ES" : "EN";
  const compLabel = `${styleLabel} · ${ctxLabel} · ${langLabel}`;

  const handleProvider = (v: CompletionProvider) => {
    onCompletionProviderChange(v);
    closeChips();
  };

  const handleDestino = (v: AgentDestination) => {
    onAgentDestinationChange(v);
    closeChips();
  };

  const handleModel = (v: string) => {
    onSelectedModelChange(v);
    closeChips();
  };

  const handleToggle = <K extends UpdateSettingMessage["key"]>(
    key: K,
    value: Extract<UpdateSettingMessage, { key: K }>["value"],
  ) => {
    onToggle(key, value);
    closeChips();
  };

  return (
    <div className="flex flex-wrap items-start gap-1 mb-2">
      <ToolbarChip
        id="motor-chip"
        label={providerLabelWithStatus}
        chipLabel="Motor"
        tooltip="Motor de sugerencias: Copilot LM, OpenCode u Ollama"
        isOpen={openChip === "motor"}
        onToggle={() => { onRequestProviderStatus(); toggleChip("motor"); }}
        onClose={closeChips}
        compact={compact}
      >
        <div className="py-1" data-key="completionProvider">
          {(["copilot", "opencode", "ollama"] as const).map((p) => {
            const pStatus = providerStatuses.find((s) =>
              p === "copilot" ? s.id === "copilot" :
              p === "opencode" ? s.id === "opencode" : s.id === "ollama",
            );
            const isActive = completionProvider === p;
            return (
              <div key={p} className={`${itemClass} flex-col items-stretch gap-1 ${isActive ? "bg-[var(--vscode-list-hoverBackground)]" : ""}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between"
                  onClick={() => {
                    if (pStatus?.status === "running" || p === "copilot") {
                      handleProvider(p);
                    } else if (pStatus?.actions?.includes("start")) {
                      onStartProvider(p);
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    {pStatus && (
                      <span className={`${statusColor(pStatus.status)} text-xs`}>
                        {statusIcon(pStatus.status)}
                      </span>
                    )}
                    <span>{p === "copilot" ? "Copilot LM" : p === "opencode" ? "OpenCode" : "Ollama"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {pStatus?.statusText && (
                      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{pStatus.statusText}</span>
                    )}
                    {isActive && (
                      <span className="text-[var(--vscode-badge-background)]">✓</span>
                    )}
                  </span>
                </button>
                {pStatus?.actions?.includes("stop") && isActive && p !== "copilot" && (
                  <button
                    type="button"
                    className={actionBtnClass}
                    onClick={() => { onStopProvider(p); closeChips(); }}
                  >
                    ■ Detener
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </ToolbarChip>

      {vsOpenCodeXExtensionInstalled && (
        <ToolbarChip
          id="destino-chip"
          label={agentDestination === "copilotChat" ? "Copilot Chat" : "VSOpenCodeX"}
          chipLabel="Destino"
          tooltip="Destino del prompt: Copilot Chat o VSOpenCodeX"
          isOpen={openChip === "destino"}
          onToggle={() => toggleChip("destino")}
          onClose={closeChips}
          compact={compact}
        >
          <div className="py-1" data-key="agentDestination">
            <button
              type="button"
              className={itemClass}
              onClick={() => handleDestino("copilotChat")}
            >
              <span>Copilot Chat</span>
              {agentDestination === "copilotChat" && (
                <span className="text-[var(--vscode-badge-background)]">✓</span>
              )}
            </button>
            <button
              type="button"
              className={itemClass}
              onClick={() => handleDestino("vsOpenCodeX")}
            >
              <span>VSOpenCodeX</span>
              {agentDestination === "vsOpenCodeX" && (
                <span className="text-[var(--vscode-badge-background)]">✓</span>
              )}
            </button>
          </div>
        </ToolbarChip>
      )}

      <ToolbarChip
        id="modelo-chip"
        label={modeloLabel}
        chipLabel="Modelo"
        tooltip="Modelo de IA y política de suscripción"
        isOpen={openChip === "modelo"}
        onToggle={() => toggleChip("modelo")}
        onClose={closeChips}
        compact={compact}
      >
        <div className="p-2 space-y-2 min-w-[200px]">
          <div data-key="suggestionModelPolicy" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Política de modelo</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(suggestionModelPolicy === "nonPremiumOnly")}
                onClick={() => handleToggle("suggestionModelPolicy", "nonPremiumOnly")}
                aria-pressed={suggestionModelPolicy === "nonPremiumOnly"}
              >
                No premium
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionModelPolicy === "anyModel")}
                onClick={() => handleToggle("suggestionModelPolicy", "anyModel")}
                aria-pressed={suggestionModelPolicy === "anyModel"}
              >
                Cualquiera
              </button>
            </div>
          </div>
          <hr className={separatorClass} />
          <div className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Modelo específico</span>
            <select
              id="model-chip-select"
              className="rounded-md border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-sm text-[var(--vscode-input-foreground)] outline-none"
              value={selectedModelId}
              onChange={(e) => handleModel(e.target.value)}
              aria-label="Modelo sugerencias"
            >
              <option value="auto">Auto</option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span
              id="model-chip-label"
              className="text-xs text-[var(--vscode-descriptionForeground)]"
              aria-live="polite"
            >
              {currentModel?.label ?? "--"}
            </span>
          </div>
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="composicion-chip"
        label={compLabel}
        chipLabel="Composición"
        tooltip="Estilo, contexto e idioma de las sugerencias"
        isOpen={openChip === "composicion"}
        onToggle={() => toggleChip("composicion")}
        onClose={closeChips}
        compact={compact}
      >
        <div className="p-2 space-y-3 min-w-[220px]">
          <div data-key="suggestionStyle" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Estilo</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "concise")}
                onClick={() => handleToggle("suggestionStyle", "concise")}
                aria-pressed={suggestionStyle === "concise"}
              >
                Breve
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "balanced")}
                onClick={() => handleToggle("suggestionStyle", "balanced")}
                aria-pressed={suggestionStyle === "balanced"}
              >
                Normal
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionStyle === "detailed")}
                onClick={() => handleToggle("suggestionStyle", "detailed")}
                aria-pressed={suggestionStyle === "detailed"}
              >
                Extenso
              </button>
            </div>
          </div>
          <div data-key="contextMode" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Contexto</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(contextMode === "basic")}
                onClick={() => handleToggle("contextMode", "basic")}
                aria-pressed={contextMode === "basic"}
              >
                Básico
              </button>
              <button
                type="button"
                className={toggleBtn(contextMode === "project")}
                onClick={() => handleToggle("contextMode", "project")}
                aria-pressed={contextMode === "project"}
              >
                Proyecto
              </button>
              <button
                type="button"
                className={toggleBtn(contextMode === "off")}
                onClick={() => handleToggle("contextMode", "off")}
                aria-pressed={contextMode === "off"}
              >
                Off
              </button>
            </div>
          </div>
          <div data-key="suggestionLanguageChoice" className="flex flex-col gap-1">
            <span className={chipLabelClass(compact)}>Idioma</span>
            <div className="flex gap-1">
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "auto")}
                onClick={() => handleToggle("suggestionLanguageChoice", "auto")}
                aria-pressed={suggestionLanguageChoice === "auto"}
              >
                Auto
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "es")}
                onClick={() => handleToggle("suggestionLanguageChoice", "es")}
                aria-pressed={suggestionLanguageChoice === "es"}
              >
                ES
              </button>
              <button
                type="button"
                className={toggleBtn(suggestionLanguageChoice === "en")}
                onClick={() => handleToggle("suggestionLanguageChoice", "en")}
                aria-pressed={suggestionLanguageChoice === "en"}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </ToolbarChip>

      <ToolbarChip
        id="gear-chip"
        label="⚙"
        tooltip="Ajustes adicionales (debug)"
        isOpen={openChip === "gear"}
        onToggle={() => toggleChip("gear")}
        onClose={closeChips}
        compact={compact}
      >
        <div className="py-1 min-w-[160px]">
          <button
            id="debug-btn"
            type="button"
            className={`${itemClass} ${debugSuggestions ? "text-[var(--vscode-badge-foreground)]" : ""}`}
            onClick={() => {
              onDebugToggle();
              closeChips();
            }}
          >
            <span>Debug</span>
            <span className="text-xs opacity-70">{debugSuggestions ? "on" : "off"}</span>
          </button>
        </div>
      </ToolbarChip>
    </div>
  );
}
