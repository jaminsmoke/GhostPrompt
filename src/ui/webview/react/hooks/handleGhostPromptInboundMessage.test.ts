/**
 * @file Tests de relay de borrador remoto (hydrate) en el handler inbound.
 */
import * as vitest from 'vitest';

import {
  handleGhostPromptInboundMessage,
  type GhostPromptInboundHandlerContext,
} from './handleGhostPromptInboundMessage';

import type { QueryClient } from '@tanstack/react-query';

const INITIAL_CAPTURE_ID = 4;

/**
 * Crea un contexto mock mínimo para mensajes draftHydrate.
 * @param {string} [viewId] - Identificador de la vista webview bajo prueba.
 * @returns {object} Handler mock y lectura del estado mutado.
 */
function createDraftHandlerMock(viewId = 'panel-a') {
  let captureId = INITIAL_CAPTURE_ID;
  let suggestion = 'ghost-from-other-draft';
  let isLoading = true;
  let text = 'before';
  let skipRelayArmed = false;

  const handler: GhostPromptInboundHandlerContext = {
    viewId,
    queryClient: {} as QueryClient,
    getCaptureId: () => captureId,
    setCaptureId: (value) => {
      captureId = value;
    },
    armSkipSuggestionOnDraftRelay: () => {
      skipRelayArmed = true;
    },
    setCompletionProvider: vitest.vi.fn(),
    setSelectedModelId: vitest.vi.fn(),
    setAvailableModels: vitest.vi.fn(),
    setSuggestionModelPolicy: vitest.vi.fn(),
    setMaxSuggestionChars: vitest.vi.fn(),
    setSuggestionDebounceMs: vitest.vi.fn(),
    setDebugSuggestions: vitest.vi.fn(),
    setAgentDestination: vitest.vi.fn(),
    setVsOpenCodeXExtensionInstalled: vitest.vi.fn(),
    setCursorDesktopHost: vitest.vi.fn(),
    setVsxActive: vitest.vi.fn(),
    setSuggestion: (value) => {
      suggestion = value;
    },
    setIsLoading: (value) => {
      isLoading = value;
    },
    setIsConfigLoaded: vitest.vi.fn(),
    setStatus: vitest.vi.fn(),
    setText: (value) => {
      text = value;
    },
    logToHost: vitest.vi.fn(),
  };

  return {
    handler,
    state: () => ({ captureId, suggestion, isLoading, text, skipRelayArmed }),
  };
}

vitest.describe('handleGhostPromptInboundMessage remote draft (hydrate)', () => {
  vitest.it('draftHydrate limpia suggestion, loading e invalida capture', () => {
    const mock = createDraftHandlerMock();
    handleGhostPromptInboundMessage(
      { data: { type: 'draftHydrate', text: 'hydrated text' } } as MessageEvent,
      mock.handler,
    );
    const state = mock.state();
    vitest.expect(state.text).toBe('hydrated text');
    vitest.expect(state.suggestion).toBe('');
    vitest.expect(state.isLoading).toBe(false);
    vitest.expect(state.skipRelayArmed).toBe(true);
    vitest.expect(state.captureId).toBe(INITIAL_CAPTURE_ID + 1);
  });

  vitest.it('suggestion stale tras hydrate se descarta por capture invalidado', () => {
    const mock = createDraftHandlerMock();
    handleGhostPromptInboundMessage(
      { data: { type: 'draftHydrate', text: 'new draft' } } as MessageEvent,
      mock.handler,
    );
    handleGhostPromptInboundMessage(
      {
        data: {
          type: 'suggestion',
          suggestion: 'stale ghost',
          captureId: INITIAL_CAPTURE_ID,
        },
      } as MessageEvent,
      mock.handler,
    );
    vitest.expect(mock.state().suggestion).toBe('');
    vitest.expect(mock.state().text).toBe('new draft');
  });
});
