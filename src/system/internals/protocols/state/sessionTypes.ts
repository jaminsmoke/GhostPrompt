/**
 * @file Contratos del estado de sesión GhostPrompt (Sidebar + Panel).
 */
import type { SuggestionModelDescriptor } from '../types/completion';

/** Estado del último intento de suggestion (UI/host). */
export type GhostPromptSuggestionFlowStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

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
  lastEffectiveModel?: SuggestionModelDescriptor;
  /** Id de captura global para descartar respuestas obsoletas entre vistas. */
  activeCaptureId: number;
}

export type GhostPromptSessionListener = (state: Readonly<GhostPromptSessionState>) => void;
