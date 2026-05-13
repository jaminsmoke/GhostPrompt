import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

type GhostPromptCapabilities = {
  compactToolbar?: boolean;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __ghostPromptViewId?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __ghostPromptCapabilities?: GhostPromptCapabilities;
  }
}

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
      broadcast?: boolean;
    }
  | {
      type: "suggestion";
      suggestion: string;
      captureId: number;
      model?: SuggestionModel;
      broadcast?: boolean;
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
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "error";
      message: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "clear";
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "draftSync";
      text: string;
      originViewId: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "draftHydrate";
      text: string;
      captureId?: number;
      broadcast?: boolean;
    }
  | {
      type: "settings";
      settings: SettingsPayload;
      captureId?: number;
      broadcast?: boolean;
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

// eslint-disable-next-line @typescript-eslint/naming-convention
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

  const syncTextareaHeight = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return;
    }
    input.style.height = "auto";
    input.style.height = `${Math.max(input.scrollHeight, 120)}px`;
  }, []);

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
    sendUpdateSetting({ type: "updateSetting", key, value } as UpdateSettingMessage);
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
      <pre className="absolute inset-0 pointer-events-none m-0 p-5 text-slate-400/70 whitespace-pre-wrap break-words" aria-hidden="true">
        <span className="opacity-30">{text}</span>
        <span className="text-slate-300">{suggestion}</span>
      </pre>
    );
  }, [suggestion, text]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto w-full max-w-6xl rounded-[28px] border border-slate-700 bg-slate-950/95 p-7 shadow-[0_28px_90px_rgba(15,23,42,0.35)]">
        <div className="mb-6 grid gap-4 xl:grid-cols-[280px_280px_420px]" aria-label="Opciones rápidas">
          <div className="flex flex-col gap-3" data-key="completionProvider">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Motor</span>
            <select
              id="completion-backend-select"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-sky-500 focus:ring-sky-500/30"
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
            <div className="flex flex-col gap-3" data-key="agentDestination">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Destino</span>
              <select
                id="agent-destination-select"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-sky-500 focus:ring-sky-500/30"
                value={agentDestination}
                onChange={handleAgentDestinationChange}
                aria-label="Destino del prompt (Copilot Chat o VSOpenCodeX)"
              >
                <option value="copilotChat">Copilot Chat</option>
                <option value="vsOpenCodeX">VSOpenCodeX</option>
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-3" data-key="suggestionModelPolicy">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Modelo</span>
            {suggestionModelPolicy === "nonPremiumOnly" ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-sky-500 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition"
                onClick={() => makeToggle("suggestionModelPolicy", "nonPremiumOnly")}
                aria-pressed="true"
              >
                No premium
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-900/80"
                onClick={() => makeToggle("suggestionModelPolicy", "nonPremiumOnly")}
                aria-pressed="false"
              >
                No premium
              </button>
            )}
            {suggestionModelPolicy === "anyModel" ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-sky-500 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition"
                onClick={() => makeToggle("suggestionModelPolicy", "anyModel")}
                aria-pressed="true"
              >
                Cualquiera
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-900/80"
                onClick={() => makeToggle("suggestionModelPolicy", "anyModel")}
                aria-pressed="false"
              >
                Cualquiera
              </button>
            )}
            <select
              id="model-select"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-sky-500 focus:ring-sky-500/30"
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
            <span
              id="model-runtime-label"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-300"
              aria-live="polite"
            >
              Modelo: {availableModels.find((m) => m.id === selectedModelId)?.label ?? "--"}
            </span>
          </div>

          <details className="rounded-2xl border border-slate-700 bg-slate-900/90" id="compose-options-details">
            <summary className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-left text-sm font-medium text-slate-100" aria-label="Opciones de composición: estilo, contexto e idioma">
              Normal · Básico · Auto (EN)
            </summary>
            <div className="grid gap-3 p-4" role="group" aria-label="Estilo, contexto e idioma">
              <div className="flex flex-col gap-2" data-key="suggestionStyle">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Estilo</span>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionStyle === "concise"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionStyle", "concise")}
                  aria-pressed={suggestionStyle === "concise" ? "true" : "false"}
                >
                  Breve
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionStyle === "balanced"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionStyle", "balanced")}
                  aria-pressed={suggestionStyle === "balanced" ? "true" : "false"}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionStyle === "detailed"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionStyle", "detailed")}
                  aria-pressed={suggestionStyle === "detailed" ? "true" : "false"}
                >
                  Extenso
                </button>
              </div>

              <div className="flex flex-col gap-2" data-key="contextMode">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Contexto</span>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    contextMode === "basic"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("contextMode", "basic")}
                  aria-pressed={contextMode === "basic" ? "true" : "false"}
                >
                  Básico
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    contextMode === "project"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("contextMode", "project")}
                  aria-pressed={contextMode === "project" ? "true" : "false"}
                >
                  Proyecto
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    contextMode === "off"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("contextMode", "off")}
                  aria-pressed={contextMode === "off" ? "true" : "false"}
                >
                  Off
                </button>
              </div>

              <div className="flex flex-col gap-2" data-key="suggestionLanguageChoice">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Idioma</span>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionLanguageChoice === "auto"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "auto")}
                  aria-pressed={suggestionLanguageChoice === "auto" ? "true" : "false"}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionLanguageChoice === "es"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "es")}
                  aria-pressed={suggestionLanguageChoice === "es" ? "true" : "false"}
                >
                  ES
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
                    suggestionLanguageChoice === "en"
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900/80"
                  }`}
                  onClick={() => makeToggle("suggestionLanguageChoice", "en")}
                  aria-pressed={suggestionLanguageChoice === "en" ? "true" : "false"}
                >
                  EN
                </button>
              </div>
            </div>
          </details>

          {debugSuggestions ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-sky-500 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 transition"
              aria-pressed="true"
              onClick={handleDebugToggle}
            >
              Debug: on
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-900/80"
              aria-pressed="false"
              onClick={handleDebugToggle}
            >
              Debug: off
            </button>
          )}
        </div>

        <p
          id="gp-vsx-surface-note"
          className="rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-300"
          role="status"
          hidden={!vsxActive}
        >
          El chat inline está desactivado: el destino del agente es VSOpenCodeX. Usa el chat de VSOpenCodeX para redactar y enviar; las sugerencias siguen el modelo y chips configurados aquí.
        </p>

        <div className="relative mb-4">
          {ghostContent}
          <textarea
            ref={textareaRef}
            id="prompt-input"
            className="w-full min-h-[160px] rounded-[18px] border border-slate-700 bg-slate-900/90 px-4 py-4 text-sm leading-6 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 resize-none"
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

        <div id="status-text" className="my-4 min-h-[26px] text-sm text-slate-300" aria-live="polite" aria-relevant="text">
          {status}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-slate-400">Tab: aceptar sugerencia · Enter: enviar · Shift+Enter: nueva línea</span>
          <button
            id="send-btn"
            className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={handleSend}
            disabled={!canSend}
          >
            Enviar ↵
          </button>
        </div>
      </section>
    </div>
  );
}
