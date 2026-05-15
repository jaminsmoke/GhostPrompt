/**
 * @file Pruebas unitarias para los helpers de estado de GhostPrompt.
 */
const globalWithWindow = globalThis as unknown as { window?: unknown };
globalWithWindow.window = globalWithWindow;

import { beforeAll, describe, expect, it } from 'vitest';

import { parseWebviewInboundMessage } from '../validators/webviewMessageSchemas';

let isDraftSyncForAnotherView: typeof import('./useGhostPrompt').isDraftSyncForAnotherView;
let shouldSkipSuggestionOnRemoteDraft: typeof import('./useGhostPrompt').shouldSkipSuggestionOnRemoteDraft;
let ghostPromptApplyInboundCaptureRef: typeof import('./useGhostPrompt').ghostPromptApplyInboundCaptureRef;

beforeAll(async () => {
  const mod = await import('./useGhostPrompt');
  isDraftSyncForAnotherView = mod.isDraftSyncForAnotherView;
  shouldSkipSuggestionOnRemoteDraft = mod.shouldSkipSuggestionOnRemoteDraft;
  ghostPromptApplyInboundCaptureRef = mod.ghostPromptApplyInboundCaptureRef;
});

describe('useGhostPrompt draft sync and hydrate handling', () => {
  it('returns true for draftSync from a different view', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'other-view',
    } as const;

    expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(true);
  });

  it('returns false for draftSync from the same view', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'current-view',
    } as const;

    expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(false);
  });

  it('returns false when viewId is missing', () => {
    const message = {
      type: 'draftSync',
      text: 'hello',
      originViewId: 'other-view',
    } as const;

    expect(isDraftSyncForAnotherView(message, '')).toBe(false);
  });

  it('returns true for draftHydrate messages', () => {
    const message = {
      type: 'draftHydrate',
      text: 'hello',
    } as const;

    expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(true);
  });

  it('returns false for non-draft messages', () => {
    const message = {
      type: 'suggestion',
      suggestion: 'world',
      captureId: 1,
    } as const;

    expect(isDraftSyncForAnotherView(message, 'current-view')).toBe(false);
  });
});

describe('webview inbound message validation', () => {
  it('returns undefined for invalid inbound payloads', () => {
    const invalidPayload = {
      type: 'settings',
      settings: {
        completionProvider: 'invalid',
      },
    } as unknown;

    expect(parseWebviewInboundMessage(invalidPayload)).toBeUndefined();
  });

  it('accepts valid settings payloads', () => {
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
        suggestionDebounceMs: 800,
        agentDestination: 'copilotChat',
        vsOpenCodeXExtensionInstalled: false,
        cursorDesktopHost: false,
      },
    } as const;

    expect(parseWebviewInboundMessage(validPayload)).toEqual(validPayload);
  });
});

describe('useGhostPrompt skip suggestion guard', () => {
  it('shouldSkipSuggestionOnRemoteDraft returns true for draftSync from another view', () => {
    const message = {
      type: 'draftSync',
      text: 'sync text',
      originViewId: 'other-view',
    } as const;

    expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(true);
  });

  it('shouldSkipSuggestionOnRemoteDraft returns false for draftSync from same view', () => {
    const message = {
      type: 'draftSync',
      text: 'sync text',
      originViewId: 'current-view',
    } as const;

    expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(false);
  });

  it('shouldSkipSuggestionOnRemoteDraft returns false for suggestion messages', () => {
    const message = {
      type: 'suggestion',
      suggestion: 'hello',
      captureId: 1,
    } as const;

    expect(shouldSkipSuggestionOnRemoteDraft(message, 'current-view')).toBe(false);
  });
});

describe('ghostPromptApplyInboundCaptureRef', () => {
  it('no baja el ref cuando llega un broadcast antiguo (evita descartar el suggest siguiente)', () => {
    let ref = 2;
    const stale = ghostPromptApplyInboundCaptureRef(ref, {
      broadcast: true,
      captureId: 1,
      type: 'loading',
    } as const);
    expect(stale.refAfter).toBe(2);
    expect(stale.drop).toBe(true);
    ref = stale.refAfter;

    const ok = ghostPromptApplyInboundCaptureRef(ref, {
      broadcast: true,
      captureId: 2,
      type: 'suggestion',
    } as const);
    expect(ok.refAfter).toBe(2);
    expect(ok.drop).toBe(false);
  });

  it('sube el ref con broadcast para vistas que solo reciben correlación del host', () => {
    const r = ghostPromptApplyInboundCaptureRef(0, {
      broadcast: true,
      captureId: 1,
      type: 'loading',
    } as const);
    expect(r.refAfter).toBe(1);
    expect(r.drop).toBe(false);
  });

  it('descarta mensaje sin broadcast si el captureId no coincide', () => {
    const r = ghostPromptApplyInboundCaptureRef(2, {
      captureId: 1,
      type: 'suggestion',
    } as const);
    expect(r.refAfter).toBe(2);
    expect(r.drop).toBe(true);
  });
});
