import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Disposable: class {
    constructor(private readonly _fn: () => void) {}
    dispose(): void {
      this._fn();
    }
  },
  CancellationTokenSource: class {
    token = { isCancellationRequested: false };
    cancel(): void {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
}));

import { GhostPromptSessionStore } from './GhostPromptSessionStore';

describe('GhostPromptSessionStore', () => {
  let store: GhostPromptSessionStore;

  beforeEach(() => {
    store = new GhostPromptSessionStore();
  });

  it('getSnapshot devuelve estado inicial coherente', () => {
    const s = store.getSnapshot();
    expect(s.draftText).toBe('');
    expect(s.pendingSuggestion).toBe('');
    expect(s.suggestionFlowStatus).toBe('idle');
    expect(s.activeCaptureId).toBe(0);
    expect(s.lastEffectiveSuggestionLanguage).toBe('en');
  });

  it('patchState fusiona y notifica suscriptores', () => {
    const listener = vi.fn();
    store.subscribe('ghostPrompt.input', listener);

    store.patchState({
      draftText: 'hola',
      lastEffectiveSuggestionLanguage: 'es',
    });

    expect(store.getSnapshot().draftText).toBe('hola');
    expect(store.getSnapshot().lastEffectiveSuggestionLanguage).toBe('es');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].draftText).toBe('hola');
  });

  it('dispose de suscripcion deja de notificar', () => {
    const listener = vi.fn();
    const sub = store.subscribe('ghostPrompt.inputPanel', listener);
    sub.dispose();

    store.patchState({ pendingSuggestion: 'x' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('prepareSuggestionRequest cancela token anterior y actualiza capture id', () => {
    const a = store.prepareSuggestionRequest(1);
    expect(store.getSnapshot().activeCaptureId).toBe(1);
    expect(store.getSnapshot().suggestionFlowStatus).toBe('loading');

    const b = store.prepareSuggestionRequest(2);
    expect(store.getSnapshot().activeCaptureId).toBe(2);
    expect(a.token.isCancellationRequested).toBe(true);

    store.disposeActiveSuggestionToken(b);
    expect(b.token.isCancellationRequested).toBe(false);
  });

  it('dos vistas suscritas reciben el mismo snapshot ante draft y estado de suggestion (multi-vista)', () => {
    const sidebar = vi.fn();
    const panel = vi.fn();

    store.subscribe('ghostPrompt.input', sidebar);
    store.subscribe('ghostPrompt.inputPanel', panel);

    store.patchState({ draftText: 'mismo borrador en ambas' });
    expect(sidebar).toHaveBeenCalledTimes(1);
    expect(panel).toHaveBeenCalledTimes(1);
    expect(sidebar.mock.calls[0][0].draftText).toBe('mismo borrador en ambas');
    expect(panel.mock.calls[0][0].draftText).toBe(sidebar.mock.calls[0][0].draftText);

    store.patchState({
      pendingSuggestion: ' sugerencia',
      suggestionFlowStatus: 'success',
    });
    expect(sidebar).toHaveBeenCalledTimes(2);
    expect(panel).toHaveBeenCalledTimes(2);
    const lastSidebar = sidebar.mock.calls[1][0];
    const lastPanel = panel.mock.calls[1][0];
    expect(lastSidebar.pendingSuggestion).toBe(' sugerencia');
    expect(lastPanel.pendingSuggestion).toBe(lastSidebar.pendingSuggestion);
    expect(lastPanel.suggestionFlowStatus).toBe('success');

    sidebar.mockClear();
    panel.mockClear();
    store.prepareSuggestionRequest(42);
    expect(sidebar).toHaveBeenCalledTimes(1);
    expect(panel).toHaveBeenCalledTimes(1);
    expect(sidebar.mock.calls[0][0].activeCaptureId).toBe(42);
    expect(sidebar.mock.calls[0][0].suggestionFlowStatus).toBe('loading');
  });
});
