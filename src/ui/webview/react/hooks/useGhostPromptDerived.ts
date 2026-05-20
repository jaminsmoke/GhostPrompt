/**
 * @file Valores derivados y acciones de sugerencia del webview GhostPrompt.
 */
import { useCallback, useMemo } from 'react';

import { WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS } from '../webviewProtocolConstants';

import { logToHost } from './ghostPromptLog';
import { postToHost } from './ghostPromptPostMessage';

import type { GhostPromptUiState } from './ghostPromptUiState';
import type { CompletionSourceStateRecord, UpdateSettingMessage } from '../types';

interface GhostPromptDerivedInput {
  ui: GhostPromptUiState;
  providerStatuses: CompletionSourceStateRecord[];
}

/**
 * Estado derivado y acciones de sugerencia (debounce vía requestSuggestion).
 * @param {GhostPromptDerivedInput} input - Estado UI y estados de proveedor.
 * @returns {object} Helpers de sugerencia y UI permitida.
 */
export function useGhostPromptDerived(input: GhostPromptDerivedInput) {
  const { ui, providerStatuses } = input;
  const {
    text,
    setText,
    suggestion,
    setSuggestion,
    status,
    setStatus,
    vsxActive,
    setIsLoading,
    completionProvider,
    currentCaptureId,
    skipSuggestionOnDraftSync,
    textareaReference,
  } = ui;

  const isGhostUiAllowed = useCallback(() => {
    const inputElement = textareaReference.current;
    if (inputElement === false) {
      return false;
    }
    if (document.activeElement !== inputElement) {
      return false;
    }
    const {length} = inputElement.value;
    return inputElement.selectionStart === length && inputElement.selectionEnd === length;
  }, [textareaReference]);

  const canSend = useMemo(() => Boolean(text.trim()) && !vsxActive, [text, vsxActive]);

  const displayStatus = useMemo(() => {
    if (completionProvider === 'ollama') {
      const ollama = providerStatuses.find((entry) => entry.id === 'ollama');
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

  const previewMaxSuggestionChars = useCallback(
    (value: number) => {
      ui.setMaxSuggestionChars(value);
    },
    [ui],
  );

  const commitMaxSuggestionChars = useCallback(
    (value: number) => {
      ui.setMaxSuggestionChars(value);
      sendUpdateSetting({
        type: 'updateSetting',
        key: 'maxSuggestionChars',
        value,
      });
    },
    [sendUpdateSetting, ui],
  );

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
  }, [isGhostUiAllowed, setStatus, setSuggestion, setText, skipSuggestionOnDraftSync, suggestion, text]);

  const requestSuggestion = useCallback(
    (draftText: string) => {
      try {
        if (vsxActive || !draftText.trim()) {
          return;
        }
        currentCaptureId.current += 1;
        const nextCaptureId = currentCaptureId.current;
        logToHost(
          'debug',
          'requestSuggestion',
          {
            text: draftText.slice(0, WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS),
            captureId: nextCaptureId,
          },
          nextCaptureId,
        );
        setIsLoading(true);
        setStatus('Solicitando sugerencia...');
        postToHost({
          type: 'suggest',
          text: draftText,
          captureId: nextCaptureId,
        });
      } catch (error) {
        logToHost('error', 'requestSuggestionFailed', { error: String(error) });
        setStatus('Error al solicitar sugerencia.');
        setIsLoading(false);
      }
    },
    [currentCaptureId, setIsLoading, setStatus, vsxActive],
  );

  return {
    isGhostUiAllowed,
    canSend,
    displayStatus,
    makeToggle,
    previewMaxSuggestionChars,
    commitMaxSuggestionChars,
    acceptSuggestion,
    requestSuggestion,
    sendUpdateSetting,
  };
}
