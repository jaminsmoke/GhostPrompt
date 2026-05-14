import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type {
  AgentDestination,
  CompletionProvider,
  GhostPromptCapabilities,
  InboundMessage,
  OutboundMessage,
  ProviderStateRecord,
  SuggestionModel,
  UpdateSettingMessage,
} from "../types";

const getInitialViewId = (): string =>
  typeof window.__ghostPromptViewId === "string" ? window.__ghostPromptViewId : "";

const getInitialCapabilities = (): GhostPromptCapabilities =>
  typeof window.__ghostPromptCapabilities === "object" &&
  window.__ghostPromptCapabilities !== null
    ? window.__ghostPromptCapabilities
    : {};

const vsCodeApi = typeof acquireVsCodeApi === "function"
  ? acquireVsCodeApi()
  : undefined;

export function postToHost(message: OutboundMessage): void {
  vsCodeApi?.postMessage(message);
}

export function useGhostPrompt() {
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
  const [providerStatuses, setProviderStatuses] = useState<ProviderStateRecord[]>([]);
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

  const makeToggle = useCallback(
    <K extends UpdateSettingMessage["key"]>(
      key: K,
      value: Extract<UpdateSettingMessage, { key: K }>["value"],
    ) => {
      sendUpdateSetting({ type: "updateSetting", key, value } as UpdateSettingMessage);
    },
    [sendUpdateSetting],
  );

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
      try {
        if (vsxActive || !draftText.trim()) {
          return;
        }
        currentCaptureId.current += 1;
        const nextCaptureId = currentCaptureId.current;
        console.log("[GP] requestSuggestion", { text: draftText.slice(0, 40), captureId: nextCaptureId });
        setIsLoading(true);
        setStatus("Solicitando sugerencia...");
        postToHost({
          type: "suggest",
          text: draftText,
          captureId: nextCaptureId,
        });
      } catch (err) {
        console.error("[GP] Error en requestSuggestion:", err);
        setStatus("Error al solicitar sugerencia.");
        setIsLoading(false);
      }
    },
    [vsxActive],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
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

        console.log("[GP] inbound message", { type: message.type, captureId: "captureId" in message ? message.captureId : undefined });

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
          if (message.settings.suggestionDebounceMs < 150) {
            console.warn("[GP] suggestionDebounceMs inválido (%d), corrigiendo a 800", message.settings.suggestionDebounceMs);
            setSuggestionDebounceMs(800);
          }
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
            setSuggestion(message.text);
            setStatus("Suggestion en progreso...");
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
        case "ollama-status":
          if (message.status === "checking-install") {
            setStatus("Verificando instalación de Ollama…");
          } else if (message.status === "not-installed") {
            setStatus("Ollama no está instalado. Instálalo desde ollama.com");
          } else if (message.status === "listing-models") {
            setStatus("Obteniendo modelos locales…");
          } else if (message.status === "starting-model") {
            setStatus("Iniciando modelo…");
          } else if (message.status === "model-ready") {
            setStatus("Modelo listo");
          } else if (message.status === "model-error") {
            setStatus(`Error: ${message.message ?? "Error al iniciar el modelo"}`);
          }
          break;
        case "providerStatus":
          setProviderStatuses(message.providers);
          break;
        default:
          break;
      }
      } catch (err) {
        console.error("[GP] Error en handleMessage:", err);
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
    try {
      const nextText = event.target.value;
      console.log("[GP] text change", { length: nextText.length });
      setText(nextText);
      if (viewId) {
        postToHost({ type: "draftChanged", text: nextText, originViewId: viewId });
      }
      syncTextareaHeight();
    } catch (err) {
      console.error("[GP] Error en handleTextChange:", err);
    }
  };

  const handleSend = () => {
    if (!text.trim() || vsxActive) {
      return;
    }
    postToHost({ type: "send", text });
    setStatus("Enviando prompt...");
  };

  const handleCompletionProviderChange = (value: CompletionProvider) => {
    setCompletionProvider(value);
    sendUpdateSetting({ type: "updateSetting", key: "completionProvider", value });
  };

  const handleAgentDestinationChange = (value: AgentDestination) => {
    setAgentDestination(value);
    setVsxActive(value === "vsOpenCodeX");
    sendUpdateSetting({ type: "updateSetting", key: "agentDestination", value });
  };

  const handleSelectedModelChange = (value: string) => {
    setSelectedModelId(value);
    sendUpdateSetting({ type: "updateSetting", key: "selectedModelId", value });
  };

  const handleDebugToggle = () => {
    const next = !debugSuggestions;
    setDebugSuggestions(next);
    sendUpdateSetting({ type: "updateSetting", key: "debugSuggestions", value: next });
  };

  const requestProviderStatus = useCallback(() => {
    postToHost({ type: "requestProviderStatus" });
  }, []);

  const startProvider = useCallback((provider: string) => {
    postToHost({ type: "startProvider", provider });
  }, []);

  const stopProvider = useCallback((provider: string) => {
    postToHost({ type: "stopProvider", provider });
  }, []);

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
    completionProvider,
    selectedModelId,
    availableModels,
    suggestionModelPolicy,
    suggestionStyle,
    contextMode,
    suggestionLanguageChoice,
    debugSuggestions,
    isLoading,
    providerStatuses,
    textareaRef,
    canSend,
    isGhostUiAllowed,
    handleTextChange,
    handleSend,
    acceptSuggestion,
    handleCompletionProviderChange,
    handleAgentDestinationChange,
    handleSelectedModelChange,
    handleDebugToggle,
    requestProviderStatus,
    startProvider,
    stopProvider,
    makeToggle,
    setStatus,
    postToHost,
  };
}
