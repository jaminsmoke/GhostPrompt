/**
 * Tipos y opciones compartidas entre proveedores de completion (Copilot LM, futuros).
 */
import type { CancellationToken } from "vscode";

import type { SuggestionLoadingPhase } from "./suggestionLoadingUi";

export type SuggestionModelPolicy = "nonPremiumOnly" | "anyModel";
export type SuggestionStyle = "concise" | "balanced" | "detailed";
export type SuggestionLanguageMode = "auto" | "manual";
export type SupportedSuggestionLanguage = "es" | "en";
export type SuggestionModelTier = "included" | "premium" | "unknown";

export const DEFAULT_MAX_SUGGESTION_CHARS = 180;
export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 12000;

export interface SuggestionModelDescriptor {
  id: string;
  label: string;
  tier: SuggestionModelTier;
  pricing?: string;
  provider?: string;
  /** Motor que debe ejecutar esta fila del selector (multi‑fuente). */
  completionSource?: "copilot" | "opencode";
}

export type CompletionResult =
  | {
      kind: "suggestion";
      suggestion: string;
      model?: SuggestionModelDescriptor;
    }
  | {
      kind: "empty";
      reason:
        | "no-model"
        | "no-included-model"
        | "premium-quota-blocked"
        | "empty-response"
        | "request-timeout"
        | "too-short"
        | "duplicate-input"
        | "rate-limited"
        | "session-budget-exhausted";
    }
  | { kind: "error"; message: string };

export interface CompletionRequestOptions {
  token: CancellationToken;
  policy: SuggestionModelPolicy;
  preferredModelId?: string;
  maxSuggestionChars?: number;
  style?: SuggestionStyle;
  context?: SuggestionContext;
  requestTimeoutMs?: number;
  /** Actualiza mensaje de carga en el webview (OpenCode: varias fases). */
  onLoadingPhase?: (phase: SuggestionLoadingPhase) => void;
  /**
   * OpenCode: texto acumulado desde SSE (`message.part.delta` en partes `text`).
   * El host debe validar `captureId` activo antes de postear al webview.
   */
  onStreamPreview?: (accumulatedText: string) => void;
}

export interface SuggestionContext {
  lastAcceptedSuggestion?: string;
  lastSentPrompt?: string;
  recentSentPrompts?: string[];
  workspaceName?: string;
  activeFilePath?: string;
  activeLanguageId?: string;
  activeSelection?: string;
  outputLanguage?: SupportedSuggestionLanguage;
}
