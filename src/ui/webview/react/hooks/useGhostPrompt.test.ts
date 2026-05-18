/**
 * @file Pruebas unitarias para los helpers de estado de GhostPrompt.
 */
import * as vitest from 'vitest';

const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import { DEFAULT_SUGGESTION_DEBOUNCE_MS } from '../../../../system/internals/protocols/constants/consPipelineDefaults';
import { parseWebviewInboundMessage } from '../validators/parseWebviewInbound';

import type * as UseGhostPromptModule from './useGhostPrompt';

let isDraftSyncForAnotherView: typeof UseGhostPromptModule.isDraftSyncForAnotherView;
let shouldSkipSuggestionOnRemoteDraft: typeof UseGhostPromptModule.shouldSkipSuggestionOnRemoteDraft;
let ghostPromptApplyInboundCaptureReference: typeof UseGhostPromptModule.ghostPromptApplyInboundCaptureReference;

vitest.beforeAll(async () => {
  ({
    isDraftSyncForAnotherView,
    shouldSkipSuggestionOnRemoteDraft,
    ghostPromptApplyInboundCaptureReference,
  } = await import('./useGhostPrompt'));
});

vitest.describe('useGhostPrompt draft sync and hydrate handling', () => {
  vitest.it('returns true for draftSync from a different view', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'other-view',
    } as const;

    vitest.expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(true);
  });

  vitest.it('returns false for draftSync from the same view', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'current-view',
    } as const;

    vitest.expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(false);
  });

  vitest.it('returns false when viewId is missing', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'other-view',
    } as const;

    vitest.expect(isDraftSyncForAnotherView(message, '')).toBe(false);
  });

  vitest.it('returns true for draftHydrate messages', () => {
    const message = {
      type: 'draftHydrate',
      text: 'hello',
    } as const;

    vitest.expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(true);
  });

  vitest.it('returns false for non-draft messages', () => {
    const message = {
      type: 'suggestion',
      suggestion: 'world',
      captureId: 1,
    } as const;

    vitest.expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(false);
  });
});

vitest.describe('webview inbound message validation', () => {
  vitest.it('returns undefined for invalid inbound payloads', () => {
    const invalidPayload = {
      type: 'settings',
      settings: {
        completionProvider: 'invalid',
      },
    } as unknown;

    vitest.expect(parseWebviewInboundMessage(invalidPayload)).toBe(false);
  });

  vitest.it('accepts valid settings payloads', () => {
    const validPayload = {
      type: 'settings',
      settings: {
        completionProvider: 'copilot',
        completionUiKind: 'copilot',
        enabledCompletionSources: ['copilot'],
        suggestionModelPolicy: 'nonPremiumOnly',
        selectedModelId: 'auto',
        availableModels: [],
        suggestionStyle: 'balanced',
        debugSuggestions: false,
        suggestionDebounceMs: DEFAULT_SUGGESTION_DEBOUNCE_MS,
        agentDestination: 'copilotChat',
        vsOpenCodeXExtensionInstalled: false,
        cursorDesktopHost: false,
      },
    } as const;

    vitest.expect(parseWebviewInboundMessage(validPayload)).toEqual(validPayload);
  });
});

vitest.describe('useGhostPrompt skip suggestion guard', () => {
  vitest.it('shouldSkipSuggestionOnRemoteDraft returns true for draftSync from another view', () => {
    const message = {
      type: 'draftSync',
      text: 'sync text',
      originViewId: 'other-view',
    } as const;

    vitest.expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(true);
  });

  vitest.it('shouldSkipSuggestionOnRemoteDraft returns false for draftSync from same view', () => {
    const message = {
      type: 'draftSync',
      text: 'sync text',
      originViewId: 'current-view',
    } as const;

    vitest.expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(false);
  });

  vitest.it('shouldSkipSuggestionOnRemoteDraft returns false for suggestion messages', () => {
    const message = {
      type: 'suggestion',
      suggestion: 'hello',
      captureId: 1,
    } as const;

    vitest.expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(false);
  });
});

vitest.describe('ghostPromptApplyInboundCaptureReference', () => {
  vitest.it('no baja el ref cuando llega un broadcast antiguo (evita descartar el suggest siguiente)', () => {
    let ref = 2;
    const stale = ghostPromptApplyInboundCaptureReference(ref, {
      broadcast: true,
      captureId: 1,
      type: 'loading',
    } as const);
    vitest.expect(stale.refAfter).toBe(2);
    vitest.expect(stale.drop).toBe(true);
    ref = stale.refAfter;

    const ok = ghostPromptApplyInboundCaptureReference(ref, {
      broadcast: true,
      captureId: 2,
      type: 'suggestion',
    } as const);
    vitest.expect(ok.refAfter).toBe(2);
    vitest.expect(ok.drop).toBe(false);
  });

  vitest.it('sube el ref con broadcast para vistas que solo reciben correlación del host', () => {
    const r = ghostPromptApplyInboundCaptureReference(0, {
      broadcast: true,
      captureId: 1,
      type: 'loading',
    } as const);
    vitest.expect(r.refAfter).toBe(1);
    vitest.expect(r.drop).toBe(false);
  });

  vitest.it('descarta mensaje sin broadcast si el captureId no coincide', () => {
    const r = ghostPromptApplyInboundCaptureReference(2, {
      captureId: 1,
      type: 'suggestion',
    } as const);
    vitest.expect(r.refAfter).toBe(2);
    vitest.expect(r.drop).toBe(true);
  });
});
