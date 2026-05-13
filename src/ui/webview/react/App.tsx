import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

type AgentDestination = "copilotChat" | "vsOpenCodeX";

type CompletionProvider = "copilot" | "opencode" | "ollama";

type SuggestionModel = {
  id: string;
  label: string;
  tier: "included" | "premium" | "unknown";
  pricing?: string;
  provider?: string;
  completionSource?: CompletionProvider;
};

type SettingsPayload = {
  completionProvider: CompletionProvider;
  completionUiKind: "copilot" | "opencode" | "ollama" | "multi";
  enabledCompletionSources: CompletionProvider[];
  suggestionModelPolicy: "nonPremiumOnly" | "anyModel";
  selectedModelId: string;
  availableModels: SuggestionModel[];
  suggestionStyle: "concise" | "balanced" | "detailed";
  contextMode: "off" | "basic" | "project";
  suggestionLanguageChoice: "auto" | "es" | "en";
  effectiveSuggestionLanguage: "es" | "en";
  effectiveModel?: SuggestionModel;
  debugSuggestions: boolean;
  suggestionDebounceMs: number;
  agentDestination: AgentDestination;
  vsOpenCodeXExtensionInstalled: boolean;
};

type InboundMessage =
  | {
      type: "loading";
      captureId: number;
      broadcast?: boolean;
      phase?: string;
      statusText?: string;
    }
  | {
      type: "suggestion-stream";
      text: string;
      captureId: number;
    }
  | {
      type: "suggestion";
      suggestion: string;
      captureId: number;
      model?: SuggestionModel;
    }
  | {
      type: "empty";
      reason:
        | "no-model"
        | "no-included-model"
        | "premium-quota-blocked"
        | "empty-response"
        | "request-timeout"
        | "too-short"
        | "duplicate-input"
        | "rate-limited"
        | "session-budget-exhausted";
      captureId: number;
    }
  | {
      type: "error";
      message: string;
      captureId: number;
    }
  | {
      type: "clear";
    }
  | {
      type: "draftSync";
      text: string;
      originViewId: string;
    }
  | {
      type: "draftHydrate";
      text: string;
    }
  | {
      type: "settings";
      settings: SettingsPayload;
    };

type UpdateSettingMessage =
  | { type: "updateSetting"; key: "suggestionModelPolicy"; value: "nonPremiumOnly" | "anyModel" }
  | { type: "updateSetting"; key: "selectedModelId"; value: string }
  | { type: "updateSetting"; key: "suggestionStyle"; value: "concise" | "balanced" | "detailed" }
  | { type: "updateSetting"; key: "contextMode"; value: "off" | "basic" | "project" }
  | { type: "updateSetting"; key: "suggestionLanguageChoice"; value: "auto" | "es" | "en" }
  | { type: "updateSetting"; key: "debugSuggestions"; value: boolean }
  | { type: "updateSetting"; key: "completionProvider"; value: CompletionProvider }
  | { type: "updateSetting"; key: "agentDestination"; value: AgentDestination };

type OutboundMessage =
  | { type: "init" }
  | { type: "suggest"; text: string; captureId: number }
  | { type: "draftChanged"; text: string; originViewId: string }
  | { type: "accept"; context: string; suggestion: string }
  | { type: "send"; text: string }
  | UpdateSettingMessage;

const getInitialViewId = (): string =>
  typeof window.__ghostPromptViewId === "string" ? window.__ghostPromptViewId : "";

const getInitialCapabilities = (): Record<string, unknown> =>
  typeof window.__ghostPromptCapabilities === "object" &&
  window.__ghostPromptCapabilities !== null
    ? window.__ghostPromptCapabilities
    : {};

const getVsCodeApi = (() => {
  if (typeof acquireVsCodeApi !== "function") {
    return undefined;
  }
  return acquireVsCodeApi();
})();

function postToHost(message: OutboundMessage): void {
  getVsCodeApi?.postMessage(message);
}

export function App(): JSX.Element {
  const [viewId] = useState(getInitialViewId);
  const [capabilities] = useState(getInitialCapabilities);
  const [text, setText] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [status, setStatus] = useState("Empieza a escribir para obtener sugerencias...");
  const [suggestionDebounceMs, setSuggestionDebounceMs] = useState(800);
  const [agentDestination, setAgentDestination] = useState<AgentDestination>("copilotChat");
  const [vsxActive, setVsxActive] = useState(false);
  const [vsOpenCodeXExtensionInstalled, setVsOpenCodeXExtensionInstalled] = useState(false);
  const [completionProvider, setCompletionProvider] = useState<CompletionProvider>("copilot");
  const [selectedModelId, setSelectedModelId] = useState("auto");
  const [availableModels, setAvailableModels] = useState<SuggestionModel[]>([]);
  const [suggestionModelPolicy, setSuggestionModelPolicy] = useState<"nonPremiumOnly" | "anyModel">("nonPremiumOnly");
  const [suggestionStyle, setSuggestionStyle] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [contextMode, setContextMode] = useState<"off" | "basic" | "project">("basic");
  const [suggestionLanguageChoice, setSuggestionLanguageChoice] = useState<"auto" | "es" | "en">("auto");
  const [debugSuggestions, setDebugSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentCaptureId = useRef(0);
  const debounceTimer = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isGhostUiAllowed = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return false;
    }
    if (document.activeElement !== input) {
      return false;
    }
    const len = input.value.length;
    return input.selectionStart === len && input.selectionEnd === len;
  }, []);

  const canSend = useMemo(() => Boolean(text.trim()) && !vsxActive, [text, vsxActive]);

  const sendUpdateSetting = useCallback((message: UpdateSettingMessage) => {
    postToHost(message);
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion || !isGhostUiAllowed()) {
      return;
    }
    const context = text;
    const inserted = suggestion;
    setText(context + inserted);
    setSuggestion("");
    setStatus("Suggestion aceptada.");
    postToHost({
      type: "accept",
      context,
      suggestion: inserted,
    });
  }, [isGhostUiAllowed, suggestion, text]);

  const requestSuggestion = useCallback(
    (draftText: string) => {
      if (vsxActive || !draftText.trim()) {
        return;
      }
      currentCaptureId.current += 1;
      const nextCaptureId = currentCaptureId.current;
      setIsLoading(true);
      setStatus("Solicitando sugerencia...");
      postToHost({
        type: "suggest",
        text: draftText,
        captureId: nextCaptureId,
      });
    },
    [vsxActive],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as InboundMessage;

      if (message.broadcast === true && typeof message.captureId === "number") {
        currentCaptureId.current = message.captureId;
      }
      if (
        typeof message.captureId === "number" &&
        message.captureId !== currentCaptureId.current &&
        message.broadcast !== true
      ) {
        return;
      }

      switch (message.type) {
        case "settings": {
          setCompletionProvider(message.settings.completionProvider);
          setSelectedModelId(message.settings.selectedModelId);
          setAvailableModels(message.settings.availableModels);
          setSuggestionModelPolicy(message.settings.suggestionModelPolicy);
          setSuggestionStyle(message.settings.suggestionStyle);
          setContextMode(message.settings.contextMode);
          setSuggestionLanguageChoice(message.settings.suggestionLanguageChoice);
          setSuggestionDebounceMs(message.settings.suggestionDebounceMs);
          setDebugSuggestions(message.settings.debugSuggestions);
          setAgentDestination(message.settings.agentDestination);
          setVsOpenCodeXExtensionInstalled(message.settings.vsOpenCodeXExtensionInstalled);
          setVsxActive(message.settings.agentDestination === "vsOpenCodeX");
          if (message.settings.agentDestination === "vsOpenCodeX") {
            setStatus("Destino VSOpenCodeX: usa VSOpenCodeX para enviar prompts.");
            setSuggestion("");
          } else {
            setStatus("Empieza a escribir para obtener sugerencias...");
          }
          break;
        }
        case "suggestion":
          setSuggestion(message.suggestion || "");
          setIsLoading(false);
          setStatus("Suggestion recibida. Presiona Tab para aceptar o Envía para enviar.");
          break;
        case "suggestion-stream":
          if (message.text) {
            setStatus("Suggestion en progreso...");
            setSuggestion(message.text);
          }
          break;
        case "empty":
          setSuggestion("");
          setIsLoading(false);
          setStatus("No hay suggestion disponible.");
          break;
        case "loading": {
          const label =
            typeof message.statusText === "string" && message.statusText.trim().length > 0
              ? message.statusText
              : "Buscando sugerencia...";
          setStatus(label);
          setIsLoading(true);
          break;
        }
        case "error":
          setSuggestion("");
          setIsLoading(false);
          setStatus(`Error: ${message.message}`);
          break;
        case "clear":
          setText("");
          setSuggestion("");
          setStatus("Prompt enviado. Escribe otro texto...");
          break;
        case "draftHydrate":
          setText(message.text);
          break;
        case "draftSync":
          if (!viewId || message.originViewId === viewId) {
            return;
          }
          setText(message.text);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    postToHost({ type: "init" });

    return () => window.removeEventListener("message", handleMessage);
  }, [viewId]);

  useEffect(() => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      requestSuggestion(text);
    }, suggestionDebounceMs);
    return () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
    };
  }, [requestSuggestion, suggestionDebounceMs, text]);

  useEffect(() => {
    syncTextareaHeight();
  }, [syncTextareaHeight]);

  const syncTextareaHeight = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return;
    }
    input.style.height = "auto";
    input.style.height = `${Math.max(input.scrollHeight, 120)}px`;
  }, []);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value;
    setText(nextText);
    if (viewId) {
      postToHost({ type: "draftChanged", text: nextText, originViewId: viewId });
    }
    syncTextareaHeight();
  };

  const handleSend = () => {
    if (!text.trim() || vsxActive) {
      return;
    }
    postToHost({ type: "send", text });
    setStatus("Enviando prompt...");
  };

  const handleCompletionProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as CompletionProvider;
    setCompletionProvider(next);
    sendUpdateSetting({ type: "updateSetting", key: "completionProvider", value: next });
  };

  const handleAgentDestinationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as AgentDestination;
    setAgentDestination(next);
    setVsxActive(next === "vsOpenCodeX");
    sendUpdateSetting({ type: "updateSetting", key: "agentDestination", value: next });
  };

  const handleSelectedModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    setSelectedModelId(next);
    sendUpdateSetting({ type: "updateSetting", key: "selectedModelId", value: next });
  };

  const makeToggle = <K extends UpdateSettingMessage["key"]>(
    key: K,
    value: Extract<UpdateSettingMessage, { key: K }>["value"],
  ) => {
    sendUpdateSetting({ type: "updateSetting", key, value });
  };

  const handleDebugToggle = () => {
    const next = !debugSuggestions;
    setDebugSuggestions(next);
    sendUpdateSetting({ type: "updateSetting", key: "debugSuggestions", value: next });
  };

  const ghostContent = useMemo(() => {
    if (!suggestion || !text.trim()) {
      return null;
    }
    return (
      <pre className="ghost-suggestion" aria-hidden="true">
        <span className="typed">{text}</span>
        <span className="suggestion">{suggestion}</span>
      </pre>
    );
  }, [suggestion, text]);

  return (
    <div className="app-shell">
      <section className="app-card">
        <div className="settings-strip" aria-label="Opciones rápidas">
          <div className="setting-group" data-key="completionProvider">
            <span className="setting-label">Motor</span>
            <select
              id="completion-backend-select"
              className="completion-backend-select chip-backend"
              value={completionProvider}
              onChange={handleCompletionProviderChange}
              aria-label="Motor de suggestions (Copilot LM u OpenCode)"
            >
              <option value="copilot">Copilot LM</option>
              <option value="opencode">OpenCode</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          {vsOpenCodeXExtensionInstalled ? (
            <div className="setting-group" data-key="agentDestination">
              <span className="setting-label">Destino</span>
              <select
                id="agent-destination-select"
                className="completion-backend-select chip-backend agent-destination-select"
                value={agentDestination}
                onChange={handleAgentDestinationChange}
                aria-label="Destino del prompt (Copilot Chat o VSOpenCodeX)"
              >
                <option value="copilotChat">Copilot Chat</option>
                <option value="vsOpenCodeX">VSOpenCodeX</option>
              </select>
            </div>
          ) : null}

          <div className="setting-group" data-key="suggestionModelPolicy">
            <span className="setting-label">Modelo</span>
            <button
              type="button"
              className={`chip ${suggestionModelPolicy === "nonPremiumOnly" ? "chip-active" : ""}`}
              onClick={() => makeToggle("suggestionModelPolicy", "nonPremiumOnly")}
              aria-pressed={suggestionModelPolicy === "nonPremiumOnly"}
            >
              No premium
            </button>
            <button
              type="button"
              className={`chip ${suggestionModelPolicy === "anyModel" ? "chip-active" : ""}`}
              onClick={() => makeToggle("suggestionModelPolicy", "anyModel")}
              aria-pressed={suggestionModelPolicy === "anyModel"}
            >
              Cualquiera
            </button>
            <select
              id="model-select"
              className="chip model-select"
              aria-label="Modelo sugerencias"
              value={selectedModelId}
              onChange={handleSelectedModelChange}
            >
              <option value="auto">Auto</option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <span id="model-runtime-label" className="chip chip-runtime" aria-live="polite">
              Modelo: {availableModels.find((m) => m.id === selectedModelId)?.label ?? "--"}
            </span>
          </div>

          <details className="gp-compose-details" id="compose-options-details">
            <summary className="gp-compose-summary chip" aria-label="Opciones de composición: estilo, contexto e idioma">
              Normal · Básico · Auto (EN)
            </summary>
            <div className="gp-compose-panel" role="group" aria-label="Estilo, contexto e idioma">
              <div className="setting-group" data-key="suggestionStyle">
                <span className="setting-label">Estilo</span>
                <button
                  type="button"
                  className={`chip ${suggestionStyle === "concise" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionStyle", "concise")}
                  aria-pressed={suggestionStyle === "concise"}
                >
                  Breve
                </button>
                <button
                  type="button"
                  className={`chip ${suggestionStyle === "balanced" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionStyle", "balanced")}
                  aria-pressed={suggestionStyle === "balanced"}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`chip ${suggestionStyle === "detailed" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionStyle", "detailed")}
                  aria-pressed={suggestionStyle === "detailed"}
                >
                  Extenso
                </button>
              </div>

              <div className="setting-group" data-key="contextMode">
                <span className="setting-label">Contexto</span>
                <button
                  type="button"
                  className={`chip ${contextMode === "basic" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("contextMode", "basic")}
                  aria-pressed={contextMode === "basic"}
                >
                  Básico
                </button>
                <button
                  type="button"
                  className={`chip ${contextMode === "project" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("contextMode", "project")}
                  aria-pressed={contextMode === "project"}
                >
                  Proyecto
                </button>
                <button
                  type="button"
                  className={`chip ${contextMode === "off" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("contextMode", "off")}
                  aria-pressed={contextMode === "off"}
                >
                  Off
                </button>
              </div>

              <div className="setting-group" data-key="suggestionLanguageChoice">
                <span className="setting-label">Idioma</span>
                <button
                  type="button"
                  className={`chip ${suggestionLanguageChoice === "auto" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "auto")}
                  aria-pressed={suggestionLanguageChoice === "auto"}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`chip ${suggestionLanguageChoice === "es" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "es")}
                  aria-pressed={suggestionLanguageChoice === "es"}
                >
                  ES
                </button>
                <button
                  type="button"
                  className={`chip ${suggestionLanguageChoice === "en" ? "chip-active" : ""}`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "en")}
                  aria-pressed={suggestionLanguageChoice === "en"}
                >
                  EN
                </button>
              </div>
            </div>
          </details>

          <button
            type="button"
            id="debug-btn"
            className={`chip chip-debug ${debugSuggestions ? "chip-active" : ""}`}
            aria-pressed={debugSuggestions}
            onClick={handleDebugToggle}
          >
            Debug: {debugSuggestions ? "on" : "off"}
          </button>
        </div>

        <p id="gp-vsx-surface-note" className="gp-vsx-surface-note" role="status" hidden={!vsxActive}>
          El chat inline está desactivado: el destino del agente es VSOpenCodeX. Usa el chat de VSOpenCodeX para redactar y enviar; las sugerencias siguen el modelo y chips configurados aquí.
        </p>

        <div className="input-stack">
          {ghostContent}
          <textarea
            ref={textareaRef}
            id="prompt-input"
            className="composer-input"
            value={text}
            onChange={handleTextChange}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                if (suggestion && isGhostUiAllowed()) {
                  event.preventDefault();
                  acceptSuggestion();
                }
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              vsxActive
                ? "Destino VSOpenCodeX activo: escribe aquí pero envía desde VSOpenCodeX."
                : "Escribe tu prompt…"
            }
            disabled={vsxActive}
            rows={5}
            spellCheck={false}
            autoFocus
          />
        </div>

        <div id="status-text" className="status-text" aria-live="polite" aria-relevant="text">
          {status}
        </div>

        <div className="toolbar">
          <span className="hint">Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea</span>
          <button id="send-btn" className="primary-button" type="button" onClick={handleSend} disabled={!canSend}>
            Enviar ↵
          </button>
        </div>
      </section>
    </div>
  );
}
