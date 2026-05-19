/**
 * @file Pruebas unitarias para los helpers de estado de GhostPrompt.
 */
import * as vitest from 'vitest';

const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import {
  minimalWebviewSettingsPayload,
  webviewOutboundValidFixtures,
} from '../../../../system/internals/protocols/validations/schemas/fixtures/webviewOutboundMessageFixtures';
import { parseWebviewInboundMessage } from '../validators/parseWebviewInbound';

import type * as UseGhostPromptModule from './useGhostPrompt';

let isDraftSyncForAnotherView: typeof UseGhostPromptModule.isDraftSyncForAnotherView;
let shouldSkipSuggestionOnRemoteDraft: typeof UseGhostPromptModule.shouldSkipSuggestionOnRemoteDraft;
let ghostPromptApplyInboundCaptureReference: typeof UseGhostPromptModule.ghostPromptApplyInboundCaptureReference;
let bumpDraftCaptureGeneration: typeof UseGhostPromptModule.bumpDraftCaptureGeneration;
let applyRemoteDraftRelay: typeof UseGhostPromptModule.applyRemoteDraftRelay;

vitest.beforeAll(async () => {
  ({
    isDraftSyncForAnotherView,
    shouldSkipSuggestionOnRemoteDraft,
    ghostPromptApplyInboundCaptureReference,
    bumpDraftCaptureGeneration,
    applyRemoteDraftRelay,
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
  vitest.it('returns false for invalid inbound payloads', () => {
    const invalidPayload = {
      type: 'settings',
      settings: {
        completionProvider: 'invalid',
      },
    } as unknown;

    vitest.expect(parseWebviewInboundMessage(invalidPayload)).toBe(false);
  });

  vitest.it('accepts valid settings payloads', () => {
    const validPayload = webviewOutboundValidFixtures.find((f) => f.id === 'settings')?.raw;
    vitest.expect(validPayload).toBeDefined();
    vitest.expect(parseWebviewInboundMessage(validPayload)).toEqual(validPayload);
    vitest.expect(minimalWebviewSettingsPayload.completionProvider).toBe('copilot');
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

const IN_FLIGHT_CAPTURE_ID = 1;
const AFTER_EDIT_CAPTURE_ID = 2;
const AFTER_REQUEST_CAPTURE_ID = 3;
const REMOTE_DRAFT_START_CAPTURE = 6;

vitest.describe('applyRemoteDraftRelay (fase FG)', () => {
  vitest.it('limpia suggestion, loading, invalida capture y arma skip debounce', () => {
    let captureId = REMOTE_DRAFT_START_CAPTURE;
    let suggestion = 'stale';
    let isLoading = true;
    let text = 'old';
    let skipArmed = false;

    applyRemoteDraftRelay('remote text', {
      getCaptureId: () => captureId,
      setCaptureId: (value) => {
        captureId = value;
      },
      setSuggestion: (value) => {
        suggestion = value;
      },
      setIsLoading: (value) => {
        isLoading = value;
      },
      armSkipSuggestionOnDraftRelay: () => {
        skipArmed = true;
      },
      setText: (value) => {
        text = value;
      },
    });

    vitest.expect(text).toBe('remote text');
    vitest.expect(suggestion).toBe('');
    vitest.expect(isLoading).toBe(false);
    vitest.expect(skipArmed).toBe(true);
    vitest.expect(captureId).toBe(REMOTE_DRAFT_START_CAPTURE + 1);
  });
});

vitest.describe('bumpDraftCaptureGeneration (fase FF)', () => {
  vitest.it('incrementa de forma monotónica', () => {
    vitest.expect(bumpDraftCaptureGeneration(0)).toBe(1);
    vitest.expect(bumpDraftCaptureGeneration(IN_FLIGHT_CAPTURE_ID)).toBe(AFTER_EDIT_CAPTURE_ID);
  });

  vitest.it('tras editar local, inbound con captureId anterior no repinta suggestion', () => {
    let captureReference = IN_FLIGHT_CAPTURE_ID;

    captureReference = bumpDraftCaptureGeneration(captureReference);

    const staleTypes = [
      { type: 'suggestion', suggestion: 'stale', captureId: IN_FLIGHT_CAPTURE_ID },
      { type: 'suggestion-stream', text: 'stale stream', captureId: IN_FLIGHT_CAPTURE_ID },
      { type: 'loading', captureId: IN_FLIGHT_CAPTURE_ID, broadcast: true },
      { type: 'empty', reason: 'too-short', captureId: IN_FLIGHT_CAPTURE_ID },
      { type: 'error', message: 'fail', captureId: IN_FLIGHT_CAPTURE_ID },
    ] as const;

    for (const payload of staleTypes) {
      const result = ghostPromptApplyInboundCaptureReference(captureReference, payload);
      vitest.expect(result.drop, payload.type).toBe(true);
    }

    captureReference = bumpDraftCaptureGeneration(captureReference);
    const fresh = ghostPromptApplyInboundCaptureReference(captureReference, {
      type: 'suggestion',
      suggestion: 'fresh',
      captureId: AFTER_REQUEST_CAPTURE_ID,
      broadcast: true,
    } as const);
    vitest.expect(fresh.drop).toBe(false);
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
