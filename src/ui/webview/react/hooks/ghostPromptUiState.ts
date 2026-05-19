/**
 * @file Estado local del webview GhostPrompt.
 */
import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { DEFAULT_SUGGESTION_DEBOUNCE_MS } from '../webviewProtocolConstants';

import type {
  AgentDestination,
  CompletionProvider,
  GhostPromptCapabilities,
  SuggestionModel,
} from '../types';

export interface GhostPromptUiState {
  viewId: string;
  capabilities: GhostPromptCapabilities;
  text: string;
  setText: Dispatch<SetStateAction<string>>;
  suggestion: string;
  setSuggestion: Dispatch<SetStateAction<string>>;
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  suggestionDebounceMs: number;
  setSuggestionDebounceMs: Dispatch<SetStateAction<number>>;
  agentDestination: AgentDestination;
  setAgentDestination: Dispatch<SetStateAction<AgentDestination>>;
  vsxActive: boolean;
  setVsxActive: Dispatch<SetStateAction<boolean>>;
  vsOpenCodeXExtensionInstalled: boolean;
  setVsOpenCodeXExtensionInstalled: Dispatch<SetStateAction<boolean>>;
  cursorDesktopHost: boolean;
  setCursorDesktopHost: Dispatch<SetStateAction<boolean>>;
  completionProvider: CompletionProvider;
  setCompletionProvider: Dispatch<SetStateAction<CompletionProvider>>;
  selectedModelId: string;
  setSelectedModelId: Dispatch<SetStateAction<string>>;
  availableModels: SuggestionModel[];
  setAvailableModels: Dispatch<SetStateAction<SuggestionModel[]>>;
  suggestionModelPolicy: 'anyModel' | 'nonPremiumOnly';
  setSuggestionModelPolicy: Dispatch<SetStateAction<'anyModel' | 'nonPremiumOnly'>>;
  suggestionStyle: 'balanced' | 'concise' | 'detailed';
  setSuggestionStyle: Dispatch<SetStateAction<'balanced' | 'concise' | 'detailed'>>;
  debugSuggestions: boolean;
  setDebugSuggestions: Dispatch<SetStateAction<boolean>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  isConfigLoaded: boolean;
  setIsConfigLoaded: Dispatch<SetStateAction<boolean>>;
  /** Generación monotónica del borrador local; sube en cada edición y otra vez al enviar `suggest`. */
  currentCaptureId: RefObject<number>;
  debounceTimer: RefObject<number | false>;
  skipSuggestionOnDraftSync: RefObject<boolean>;
  textareaReference: RefObject<HTMLTextAreaElement | false>;
}

const getInitialViewId = (): string => {
  const viewId = globalThis.__ghostPromptViewId;
  return typeof viewId === 'string' && viewId.length > 0 ? viewId : 'unknown';
};

const getInitialCapabilities = (): GhostPromptCapabilities =>
  globalThis.__ghostPromptCapabilities ?? {};

/**
 * Estado local del webview GhostPrompt (texto, settings y refs de correlación).
 * @returns {GhostPromptUiState} Estado y setters compartidos por el hook principal.
 */
export function useGhostPromptUiState(): GhostPromptUiState {
  const [viewId] = useState(getInitialViewId);
  const [capabilities] = useState(getInitialCapabilities);
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [status, setStatus] = useState('Empieza a escribir para obtener sugerencias...');
  const [suggestionDebounceMs, setSuggestionDebounceMs] = useState(DEFAULT_SUGGESTION_DEBOUNCE_MS);
  const [agentDestination, setAgentDestination] = useState<AgentDestination>('copilotChat');
  const [vsxActive, setVsxActive] = useState(false);
  const [vsOpenCodeXExtensionInstalled, setVsOpenCodeXExtensionInstalled] = useState(false);
  const [cursorDesktopHost, setCursorDesktopHost] = useState(false);
  const [completionProvider, setCompletionProvider] = useState<CompletionProvider>('copilot');
  const [selectedModelId, setSelectedModelId] = useState('auto');
  const [availableModels, setAvailableModels] = useState<SuggestionModel[]>([]);
  const [suggestionModelPolicy, setSuggestionModelPolicy] = useState<'anyModel' | 'nonPremiumOnly'>(
    'nonPremiumOnly',
  );
  const [suggestionStyle, setSuggestionStyle] = useState<'balanced' | 'concise' | 'detailed'>(
    'balanced',
  );
  const [debugSuggestions, setDebugSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  /** Correlación draft: invalidar en cada tecla; el host devuelve el mismo id en loading/suggestion/empty/error. */
  const currentCaptureId = useRef(0);
  const debounceTimer = useRef<number | false>(false);
  const skipSuggestionOnDraftSync = useRef(false);
  const textareaReference = useRef<HTMLTextAreaElement | false>(false);

  return {
    viewId,
    capabilities,
    text,
    setText,
    suggestion,
    setSuggestion,
    status,
    setStatus,
    suggestionDebounceMs,
    setSuggestionDebounceMs,
    agentDestination,
    setAgentDestination,
    vsxActive,
    setVsxActive,
    vsOpenCodeXExtensionInstalled,
    setVsOpenCodeXExtensionInstalled,
    cursorDesktopHost,
    setCursorDesktopHost,
    completionProvider,
    setCompletionProvider,
    selectedModelId,
    setSelectedModelId,
    availableModels,
    setAvailableModels,
    suggestionModelPolicy,
    setSuggestionModelPolicy,
    suggestionStyle,
    setSuggestionStyle,
    debugSuggestions,
    setDebugSuggestions,
    isLoading,
    setIsLoading,
    isConfigLoaded,
    setIsConfigLoaded,
    currentCaptureId,
    debounceTimer,
    skipSuggestionOnDraftSync,
    textareaReference,
  };
}
