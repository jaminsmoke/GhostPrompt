import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hostQuery } from '../utils/hostQuery';
import type {
  AgentDestination,
  CompletionProvider,
  GhostPromptCapabilities,
  InboundMessage,
  OutboundMessage,
  ProviderStateRecord,
  SuggestionModel,
  UpdateSettingMessage,
} from '../types';

/**
 * Determina si un mensaje de borrador remoto proviene de otra vista GhostPrompt.
 * @param {InboundMessage} message Mensaje entrante desde el host.
 * @param {string} viewId Identificador de la vista actual.
 * @returns {message is Extract<InboundMessage, { type: 'draftSync' }>} True si es borrador sincronizado de otra vista.
 */
export function isDraftSyncForAnotherView(
  message: InboundMessage,
  viewId: string,
): message is Extract<InboundMessage, { type: 'draftSync' }> {
  return message.type === 'draftSync' && Boolean(viewId) && message.originViewId !== viewId;
}

/**
 * Comprueba si la sugerencia debe saltarse porque el mensaje es un borrador remoto.
 * @param {InboundMessage} message Mensaje entrante desde el host.
 * @param {string} viewId Identificador de la vista actual.
 * @returns {boolean} True si debe saltarse la sugerencia.
 */
export function shouldSkipSuggestionOnRemoteDraft(
  message: InboundMessage,
  viewId: string,
): boolean {
  return message.type === 'draftHydrate' || isDraftSyncForAnotherView(message, viewId);
}

/** Mensajes host→webview que pueden llevar `captureId` / `broadcast` para correlación. */
export type GhostPromptInboundCaptureCarrier = {
  broadcast?: boolean;
  captureId?: number;
};

/**
 * Actualiza el ref de correlación y decide si el mensaje debe ignorarse (respuestas obsoletas).
 * Expuesto para tests unitarios del filtro.
 */
/**
 * Actualiza el ref de correlación y decide si el mensaje entrante debe descartar la respuesta obsoleta.
 * @param {number} refBefore Ref anterior de captura.
 * @param {GhostPromptInboundCaptureCarrier} message Mensaje entrante con posible captureId/broadcast.
 * @returns {{ refAfter: number; drop: boolean }} Ref actualizado y bandera de descarte.
 */
export function ghostPromptApplyInboundCaptureRef(
  refBefore: number,
  message: GhostPromptInboundCaptureCarrier,
): { refAfter: number; drop: boolean } {
  let nextRef = refBefore;
  if (message.broadcast === true && typeof message.captureId === 'number') {
    nextRef = Math.max(nextRef, message.captureId);
  }
  if (typeof message.captureId === 'number') {
    if (message.captureId < nextRef) {
      return { refAfter: nextRef, drop: true };
    }
    if (message.captureId !== nextRef && message.broadcast !== true) {
      return { refAfter: nextRef, drop: true };
    }
  }
  return { refAfter: nextRef, drop: false };
}

const getInitialViewId = (): string =>
  typeof window.__ghostPromptViewId === 'string' ? window.__ghostPromptViewId : '';

const getInitialCapabilities = (): GhostPromptCapabilities =>
  typeof window.__ghostPromptCapabilities === 'object' && window.__ghostPromptCapabilities !== null
    ? window.__ghostPromptCapabilities
    : {};

interface VsCodeApi {
  postMessage(message: unknown): void;
}

const windowWithVsCodeApi = window as Window & {
  acquireVsCodeApi?: () => VsCodeApi;
};

const vsCodeApi =
  typeof windowWithVsCodeApi.acquireVsCodeApi === 'function'
    ? windowWithVsCodeApi.acquireVsCodeApi()
    : undefined;

/**
 * Envía un mensaje desde el webview React al host de VS Code.
 * @param message Payload outbound que se transmite al host.
 */
/**
 * Envía un mensaje desde el webview React al host de VS Code.
 * @param {OutboundMessage} message Payload outbound que se transmite al host.
 * @returns {void}
 */
export function postToHost(message: OutboundMessage): void {
  vsCodeApi?.postMessage(message);
}

/**
 * Hook principal de GhostPrompt para el webview React.
 * Gestiona estado local, comunicación con el host y sugerencias.
 * @returns {object} API y estado de GhostPrompt para el componente.
 */
export function useGhostPrompt() {
  const [viewId] = useState(getInitialViewId);
  const [capabilities] = useState(getInitialCapabilities);
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [status, setStatus] = useState('Empieza a escribir para obtener sugerencias...');
  const [suggestionDebounceMs, setSuggestionDebounceMs] = useState(800);
  const [agentDestination, setAgentDestination] = useState<AgentDestination>('copilotChat');
  const [vsxActive, setVsxActive] = useState(false);
  const [vsOpenCodeXExtensionInstalled, setVsOpenCodeXExtensionInstalled] = useState(false);
  const [completionProvider, setCompletionProvider] = useState<CompletionProvider>('copilot');
  const [selectedModelId, setSelectedModelId] = useState('auto');
  const [availableModels, setAvailableModels] = useState<SuggestionModel[]>([]);
  const [suggestionModelPolicy, setSuggestionModelPolicy] = useState<'nonPremiumOnly' | 'anyModel'>(
    'nonPremiumOnly',
  );
  const [suggestionStyle, setSuggestionStyle] = useState<'concise' | 'balanced' | 'detailed'>(
    'balanced',
  );
  const [suggestionLanguageChoice, setSuggestionLanguageChoice] = useState<'auto' | 'es' | 'en'>(
    'auto',
  );
  const [_effectiveLanguage, setEffectiveLanguage] = useState<'es' | 'en'>('es');
  const [debugSuggestions, setDebugSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentCaptureId = useRef(0);
  const debounceTimer = useRef<number | null>(null);
  const skipSuggestionOnDraftSync = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const queryClient = useQueryClient();

  const { data: providerStatuses = [], isLoading: statusLoading } = useQuery({
    queryKey: ['providerStatus'],
    queryFn: () =>
      hostQuery<{ providers: ProviderStateRecord[] }>(
        { type: 'requestProviderStatus' },
        'providerStatus',
        postToHost,
      ).then((r) => r.providers),
    staleTime: 30_000,
  });

  const { mutate: mutateStartProvider } = useMutation({
    mutationFn: (provider: string) =>
      hostQuery<{ providers: ProviderStateRecord[] }>(
        { type: 'startProvider', provider },
        'providerStatus',
        postToHost,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerStatus'] });
    },
  });

  const { mutate: mutateStopProvider } = useMutation({
    mutationFn: (provider: string) =>
      hostQuery<{ providers: ProviderStateRecord[] }>(
        { type: 'stopProvider', provider },
        'providerStatus',
        postToHost,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerStatus'] });
    },
  });

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

  const displayStatus = useMemo(() => {
    if (completionProvider === 'ollama') {
      const ollama = providerStatuses.find((s) => s.id === 'ollama');
      if (ollama) {
        if (ollama.status === 'unavailable') {
          return 'Ollama no está instalado';
        }
        if (ollama.status === 'stopped') {
          if (ollama.statusText?.includes('sin modelos')) {
            return 'Ollama — sin modelos instalados';
          }
          return 'Selecciona un modelo de Ollama';
        }
        if (ollama.status === 'starting') {
          return 'Iniciando modelo…';
        }
        if (ollama.status === 'running') {
          return 'Modelo listo';
        }
      }
    }
    return status;
  }, [completionProvider, providerStatuses, status]);

  const sendUpdateSetting = useCallback((message: UpdateSettingMessage) => {
    postToHost(message);
  }, []);

  const makeToggle = useCallback(
    (key: string, value: string) => {
      sendUpdateSetting({ type: 'updateSetting', key, value } as UpdateSettingMessage);
    },
    [sendUpdateSetting],
  );

  const acceptSuggestion = useCallback(() => {
    if (!suggestion || !isGhostUiAllowed()) {
      return;
    }
    const context = text;
    const inserted = suggestion;
    skipSuggestionOnDraftSync.current = true;
    setText(context + inserted);
    setSuggestion('');
    setStatus('Suggestion aceptada.');
    postToHost({
      type: 'accept',
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
        console.log('[GP] requestSuggestion', {
          text: draftText.slice(0, 40),
          captureId: nextCaptureId,
        });
        setIsLoading(true);
        setStatus('Solicitando sugerencia...');
        postToHost({
          type: 'suggest',
          text: draftText,
          captureId: nextCaptureId,
        });
      } catch (err) {
        console.error('[GP] Error en requestSuggestion:', err);
        setStatus('Error al solicitar sugerencia.');
        setIsLoading(false);
      }
    },
    [vsxActive],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = event.data as InboundMessage;

        const { refAfter, drop } = ghostPromptApplyInboundCaptureRef(
          currentCaptureId.current,
          message,
        );
        currentCaptureId.current = refAfter;
        if (drop) {
          return;
        }

        console.log('[GP] inbound message', {
          type: message.type,
          captureId: 'captureId' in message ? message.captureId : undefined,
        });

        switch (message.type) {
          case 'settings': {
            setCompletionProvider(message.settings.completionProvider);
            setSelectedModelId(message.settings.selectedModelId);
            setAvailableModels(message.settings.availableModels);
            setSuggestionModelPolicy(message.settings.suggestionModelPolicy);
            setSuggestionStyle(message.settings.suggestionStyle);
            setSuggestionLanguageChoice(message.settings.suggestionLanguageChoice);
            setSuggestionDebounceMs(message.settings.suggestionDebounceMs);
            if (message.settings.suggestionDebounceMs < 150) {
              console.warn(
                '[GP] suggestionDebounceMs inválido (%d), corrigiendo a 800',
                message.settings.suggestionDebounceMs,
              );
              setSuggestionDebounceMs(800);
            }
            setDebugSuggestions(message.settings.debugSuggestions);
            setAgentDestination(message.settings.agentDestination);
            setVsOpenCodeXExtensionInstalled(message.settings.vsOpenCodeXExtensionInstalled);
            setVsxActive(message.settings.agentDestination === 'vsOpenCodeX');
            if (message.settings.agentDestination === 'vsOpenCodeX') {
              setStatus('Destino VSOpenCodeX: usa VSOpenCodeX para enviar prompts.');
              setSuggestion('');
            } else {
              setStatus('Empieza a escribir para obtener sugerencias...');
            }
            break;
          }
          case 'suggestion':
            setSuggestion(message.suggestion || '');
            setIsLoading(false);
            setStatus('Suggestion recibida. Presiona Tab para aceptar o Envía para enviar.');
            break;
          case 'suggestion-stream':
            if (message.text) {
              setSuggestion(message.text);
              setStatus('Suggestion en progreso...');
            }
            break;
          case 'empty':
            setSuggestion('');
            setIsLoading(false);
            setStatus('No hay suggestion disponible.');
            break;
          case 'loading': {
            const label =
              typeof message.statusText === 'string' && message.statusText.trim().length > 0
                ? message.statusText
                : 'Buscando sugerencia...';
            setStatus(label);
            setIsLoading(true);
            break;
          }
          case 'error':
            setSuggestion('');
            setIsLoading(false);
            setStatus(`Error: ${message.message}`);
            break;
          case 'clear':
            setText('');
            setSuggestion('');
            setStatus('Prompt enviado. Escribe otro texto...');
            break;
          case 'draftHydrate':
            if (shouldSkipSuggestionOnRemoteDraft(message, viewId)) {
              skipSuggestionOnDraftSync.current = true;
            }
            setText(message.text);
            break;
          case 'languageEffective':
            setEffectiveLanguage(message.language);
            break;
          case 'draftSync':
            if (!shouldSkipSuggestionOnRemoteDraft(message, viewId)) {
              return;
            }
            skipSuggestionOnDraftSync.current = true;
            setText(message.text);
            break;
          case 'providerStatus':
            queryClient.setQueryData<ProviderStateRecord[]>(['providerStatus'], message.providers);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('[GP] Error en handleMessage:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    postToHost({ type: 'init' });

    return () => window.removeEventListener('message', handleMessage);
  }, [viewId, queryClient]);

  const syncTextareaHeight = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return;
    }
    input.style.height = 'auto';
    input.style.height = `${Math.max(input.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      if (skipSuggestionOnDraftSync.current) {
        skipSuggestionOnDraftSync.current = false;
        return;
      }
      if (!isGhostUiAllowed()) {
        return;
      }
      requestSuggestion(text);
    }, suggestionDebounceMs);
    return () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
    };
  }, [requestSuggestion, suggestionDebounceMs, text, isGhostUiAllowed]);

  useEffect(() => {
    syncTextareaHeight();
  }, [syncTextareaHeight]);

  const handleCursorCheck = useCallback(() => {
    if (!isGhostUiAllowed()) {
      setSuggestion('');
    }
  }, [isGhostUiAllowed]);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const nextText = event.target.value;
      console.log('[GP] text change', { length: nextText.length });
      skipSuggestionOnDraftSync.current = false;
      setSuggestion('');
      setText(nextText);
      if (viewId) {
        postToHost({ type: 'draftChanged', text: nextText, originViewId: viewId });
      }
      syncTextareaHeight();
    } catch (err) {
      console.error('[GP] Error en handleTextChange:', err);
    }
  };

  const handleSend = () => {
    if (!text.trim() || vsxActive) {
      return;
    }
    postToHost({ type: 'send', text });
    setStatus('Enviando prompt...');
  };

  const handleCompletionProviderChange = (value: CompletionProvider) => {
    setCompletionProvider(value);
    sendUpdateSetting({ type: 'updateSetting', key: 'completionProvider', value });
    if (value === 'ollama') {
      setSelectedModelId('');
    }
  };

  const handleAgentDestinationChange = (value: AgentDestination) => {
    setAgentDestination(value);
    setVsxActive(value === 'vsOpenCodeX');
    sendUpdateSetting({ type: 'updateSetting', key: 'agentDestination', value });
  };

  const handleSelectedModelChange = (value: string) => {
    setSelectedModelId(value);
    sendUpdateSetting({ type: 'updateSetting', key: 'selectedModelId', value });
    if (completionProvider === 'ollama' && value) {
      queryClient.setQueryData<ProviderStateRecord[]>(['providerStatus'], (old) =>
        old?.map((p) =>
          p.id === 'ollama' ? { ...p, status: 'starting' as const, statusText: 'Iniciando…' } : p,
        ),
      );
    }
  };

  const handleDebugToggle = () => {
    const next = !debugSuggestions;
    setDebugSuggestions(next);
    sendUpdateSetting({ type: 'updateSetting', key: 'debugSuggestions', value: next });
  };

  const startProvider = useCallback(
    (provider: string) => {
      mutateStartProvider(provider);
    },
    [mutateStartProvider],
  );

  const stopProvider = useCallback(
    (provider: string) => {
      mutateStopProvider(provider);
    },
    [mutateStopProvider],
  );

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
    suggestionLanguageChoice,
    debugSuggestions,
    isLoading,
    statusLoading,
    displayStatus,
    providerStatuses,
    textareaRef,
    canSend,
    isGhostUiAllowed,
    handleCursorCheck,
    handleTextChange,
    handleSend,
    acceptSuggestion,
    handleCompletionProviderChange,
    handleAgentDestinationChange,
    handleSelectedModelChange,
    handleDebugToggle,
    startProvider,
    stopProvider,
    makeToggle,
    setStatus,
    postToHost,
  };
}
