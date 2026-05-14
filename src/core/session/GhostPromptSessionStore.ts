/**
 * @file Estado de sesión único para todas las vistas GhostPrompt (Sidebar + Panel).
 * Sprint v0.2.4b: fuente de verdad en host para draft/suggestions efectivas y settings runtime.
 */
import * as vscode from "vscode";
import type {
  SuggestionModelDescriptor,
  SupportedSuggestionLanguage,
} from "../types";

/** Estado del último intento de suggestion (UI/host). */
export type GhostPromptSuggestionFlowStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";

export interface GhostPromptSessionState {
  /** Texto en curso del usuario (Sprint 2: sincronizado desde webviews). */
  draftText: string;
  /** Última suggestion devuelta por el modelo (normalizada). */
  pendingSuggestion: string;
  suggestionFlowStatus: GhostPromptSuggestionFlowStatus;
  /** Mensaje breve si suggestionFlowStatus === "error". */
  lastSuggestionError?: string;
  lastAcceptedSuggestion: string;
  lastSentPrompt: string;
  recentSentPrompts: readonly string[];
  lastEffectiveSuggestionLanguage: SupportedSuggestionLanguage;
  lastEffectiveModel?: SuggestionModelDescriptor;
  /** Id de captura global para descartar respuestas obsoletas entre vistas. */
  activeCaptureId: number;
}

/**
 * Crea el estado inicial por defecto para GhostPrompt.
 * @returns Estado inicial para reiniciar el singleton de sesión.
 */
function createInitialSessionState(): GhostPromptSessionState {
  return {
    draftText: "",
    pendingSuggestion: "",
    suggestionFlowStatus: "idle",
    lastAcceptedSuggestion: "",
    lastSentPrompt: "",
    recentSentPrompts: [],
    lastEffectiveSuggestionLanguage: "en",
    lastEffectiveModel: undefined,
    activeCaptureId: 0,
  };
}

export type GhostPromptSessionListener = (
  state: Readonly<GhostPromptSessionState>,
) => void;

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
   * @param partial Campos parciales que se aplican al estado existente.
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
   * @param viewId Identificador único de la vista que se está suscribiendo.
   * @param listener Callback que se invoca cuando el estado cambia.
   * @returns Disposable para cancelar la suscripción.
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
   * @param captureId Identificador de la captura actual de sugerencia.
   * @returns Token de cancelación para la solicitud en curso.
   */
  public prepareSuggestionRequest(captureId: number): vscode.CancellationTokenSource {
    this._activeSuggestionToken?.cancel();
    this._activeSuggestionToken?.dispose();
    const tokenSource = new vscode.CancellationTokenSource();
    this._activeSuggestionToken = tokenSource;
    this.patchState({
      activeCaptureId: captureId,
      suggestionFlowStatus: "loading",
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
