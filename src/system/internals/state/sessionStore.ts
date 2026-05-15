/**
 * @file Store singleton de sesión GhostPrompt (Sidebar + Panel).
 */
import * as vscode from 'vscode';

import type {
  GhostPromptSessionListener,
  GhostPromptSessionState,
} from '../protocols/state/sessionTypes';

/**
 * Crea el estado inicial por defecto para GhostPrompt.
 * @returns {GhostPromptSessionState} Estado inicial para reiniciar el singleton de sesión.
 */
function createInitialSessionState(): GhostPromptSessionState {
  return {
    draftText: '',
    pendingSuggestion: '',
    suggestionFlowStatus: 'idle',
    lastAcceptedSuggestion: '',
    lastSentPrompt: '',
    recentSentPrompts: [],
    lastEffectiveModel: undefined,
    activeCaptureId: 0,
  };
}

/**
 * Store singleton compartido por todas las instancias de MiniInputViewProvider.
 */
export class GhostPromptSessionStore {
  private _state: GhostPromptSessionState = createInitialSessionState();
  private readonly _subscribers = new Map<string, Set<GhostPromptSessionListener>>();
  private _activeSuggestionToken?: vscode.CancellationTokenSource;

  public getSnapshot(): Readonly<GhostPromptSessionState> {
    return this._state;
  }

  /**
   * Fusiona campos en el estado y notifica suscriptores.
   * @param {Partial<GhostPromptSessionState>} partial Campos parciales que se aplican al estado existente.
   */
  public patchState(partial: Partial<GhostPromptSessionState>): void {
    const next: GhostPromptSessionState = {
      ...this._state,
      ...partial,
    };
    if (partial.recentSentPrompts !== undefined) {
      next.recentSentPrompts = [...partial.recentSentPrompts];
    }
    this._state = next;
    this._notifyAll();
  }

  /**
   * Suscripción por identificador de vista (ej. `ghostPrompt.input` vs `ghostPrompt.inputPanel`).
   * @param {string} viewId Identificador único de la vista que se está suscribiendo.
   * @param {GhostPromptSessionListener} listener Callback que se invoca cuando el estado cambia.
   * @returns {vscode.Disposable} Disposable para cancelar la suscripción.
   */
  public subscribe(viewId: string, listener: GhostPromptSessionListener): vscode.Disposable {
    let set = this._subscribers.get(viewId);
    if (!set) {
      set = new Set();
      this._subscribers.set(viewId, set);
    }
    set.add(listener);
    return new vscode.Disposable(() => {
      const listeners = this._subscribers.get(viewId);
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        this._subscribers.delete(viewId);
      }
    });
  }

  /**
   * Inicia un nuevo intento de suggestion: cancela request anterior, fija capture id y estado loading.
   * @param {number} captureId Identificador de la captura actual de sugerencia.
   * @returns {vscode.CancellationTokenSource} Token de cancelación para la solicitud en curso.
   */
  public prepareSuggestionRequest(captureId: number): vscode.CancellationTokenSource {
    this._activeSuggestionToken?.cancel();
    this._activeSuggestionToken?.dispose();
    const tokenSource = new vscode.CancellationTokenSource();
    this._activeSuggestionToken = tokenSource;
    this.patchState({
      activeCaptureId: captureId,
      suggestionFlowStatus: 'loading',
      lastSuggestionError: undefined,
    });
    return tokenSource;
  }

  public clearActiveSuggestionTokenIf(tokenSource: vscode.CancellationTokenSource): void {
    if (this._activeSuggestionToken === tokenSource) {
      this._activeSuggestionToken = undefined;
      tokenSource.dispose();
    }
  }

  public disposeActiveSuggestionToken(tokenSource: vscode.CancellationTokenSource): void {
    this.clearActiveSuggestionTokenIf(tokenSource);
  }

  private _notifyAll(): void {
    const snapshot = this.getSnapshot();
    for (const listeners of this._subscribers.values()) {
      for (const listener of listeners) {
        listener(snapshot);
      }
    }
  }

  /**
   * Reinicia el estado de sesión (principalmente para tests que comparten el singleton).
   * No invocar desde el flujo normal de la extensión.
   */
  public resetSessionState(): void {
    this._activeSuggestionToken?.cancel();
    this._activeSuggestionToken?.dispose();
    this._activeSuggestionToken = undefined;
    this._state = createInitialSessionState();
    this._notifyAll();
  }
}

/** Instancia única compartida por Sidebar y Panel. */
export const ghostPromptSessionStore = new GhostPromptSessionStore();
