import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";

type AgentDestination = "copilotChat" | "vsOpenCodeX";

type SuggestionModel = {
  id: string;
  label: string;
  tier: "included" | "premium" | "unknown";
  pricing?: string;
  provider?: string;
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
      settings: {
        suggestionDebounceMs?: number;
        agentDestination?: AgentDestination;
        vsOpenCodeXExtensionInstalled?: boolean;
        [key: string]: unknown;
      };
    };

type OutboundMessage =
  | {
      type: "suggest";
      text: string;
      captureId: number;
    }
  | {
      type: "draftChanged";
      text: string;
      originViewId: string;
    }
  | {
      type: "send";
      text: string;
    }
  | {
      type: "accept";
      context: string;
      suggestion: string;
    };

const getInitialViewId = (): string =>
  typeof window.__ghostPromptViewId === "string" ? window.__ghostPromptViewId : "";

const getInitialCapabilities = (): Record<string, unknown> =>
  typeof window.__ghostPromptCapabilities === "object" &&
  window.__ghostPromptCapabilities !== null
    ? window.__ghostPromptCapabilities
    : {};

export function App(): JSX.Element {
  const [viewId] = useState(getInitialViewId);
  const [capabilities] = useState(getInitialCapabilities);
  const [text, setText] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [status, setStatus] = useState("Empieza a escribir para obtener sugerencias...");
  const [suggestionDebounceMs, setSuggestionDebounceMs] = useState(800);
  const [agentDestination, setAgentDestination] = useState<AgentDestination>(
    "copilotChat",
  );
  const [vsxActive, setVsxActive] = useState(false);
  const [captureId, setCaptureId] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const canSend = useMemo(
    () => Boolean(text.trim()) && !vsxActive,
    [text, vsxActive],
  );

  const postMessage = useCallback((message: OutboundMessage) => {
    if (typeof acquireVsCodeApi !== "function") {
      return;
    }
    acquireVsCodeApi().postMessage(message);
  }, []);

  const requestSuggestion = useCallback(
    (draftText: string) => {
      if (vsxActive || !draftText.trim()) {
        return;
      }
      const nextCaptureId = captureId + 1;
      setCaptureId(nextCaptureId);
      setIsLoading(true);
      setStatus("Solicitando sugerencia...");
      postMessage({
        type: "suggest",
        text: draftText,
        captureId: nextCaptureId,
      });
    },
    [captureId, postMessage, vsxActive],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as InboundMessage;
      switch (message?.type) {
        case "settings":
          if (typeof message.settings.suggestionDebounceMs === "number") {
            setSuggestionDebounceMs(message.settings.suggestionDebounceMs);
          }
          if (message.settings.agentDestination === "vsOpenCodeX") {
            setAgentDestination("vsOpenCodeX");
            setVsxActive(true);
            setStatus("Destino VSOpenCodeX: usa VSOpenCodeX para enviar prompts.");
            setSuggestion("");
          } else {
            setAgentDestination("copilotChat");
            setVsxActive(false);
            setStatus("Empieza a escribir para obtener sugerencias...");
          }
          break;
        case "suggestion":
          setSuggestion(message.suggestion || "");
          setIsLoading(false);
          setStatus("Suggestion recibida. Presiona Tab para aceptar o Envía para enviar.");
          break;
        case "empty":
          setSuggestion("");
          setIsLoading(false);
          setStatus("No hay suggestion disponible.");
          break;
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
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      requestSuggestion(text);
    }, suggestionDebounceMs);
    return () => window.clearTimeout(timer);
  }, [text, requestSuggestion, suggestionDebounceMs]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value;
    setText(nextText);
    postMessage({
      type: "draftChanged",
      text: nextText,
      originViewId: viewId,
    });
  };

  const handleSend = () => {
    if (!text.trim() || vsxActive) {
      return;
    }
    postMessage({ type: "send", text });
    setStatus("Enviando prompt... ");
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
        <header className="app-header">
          <div>
            <h1>GhostPrompt React</h1>
            <p className="subtitle">Fase 2: migrando el composer y la comunicación host/webview.</p>
          </div>
          <span className={`status-pill ${vsxActive ? "status-vsx" : "status-normal"}`}>
            {agentDestination}
          </span>
        </header>

        <div className="composer-panel">
          <label htmlFor="prompt-input" className="sr-only">
            Escribe tu prompt
          </label>
          {ghostContent}
          <textarea
            id="prompt-input"
            className="composer-input"
            value={text}
            onChange={handleTextChange}
            placeholder={
              vsxActive
                ? "Destino VSOpenCodeX activo: escribe aquí pero envía desde VSOpenCodeX."
                : "Escribe tu prompt…"
            }
            disabled={vsxActive}
            rows={5}
          />
        </div>

        <div className="toolbar-row">
          <button
            type="button"
            className="primary-button"
            onClick={handleSend}
            disabled={!canSend}
          >
            Enviar prompt
          </button>
          <span className="toolbar-status">{status}</span>
        </div>

        {isLoading && <div className="loading-bar">Solicitando...</div>}

        <footer className="footer-note">
          <span>Capabilities: {JSON.stringify(capabilities)}</span>
        </footer>
      </section>
    </div>
  );
}
