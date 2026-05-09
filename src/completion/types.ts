/**
 * Tipos y opciones compartidas entre proveedores de completion (Copilot LM, futuros).
 */
import type { CancellationToken } from "vscode";

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
