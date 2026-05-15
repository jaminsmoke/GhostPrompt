/**
 * @file Tipos y contratos comunes para solicitudes y resultados de completado.
 */
import type { SuggestionStyle } from '../../../../sugcore/sugstyle/styleLengthController';
import type { SuggestionLoadingPhase } from '../state/loading/loadingPhase';
import type { CancellationToken } from 'vscode';

export type SuggestionModelPolicy = 'nonPremiumOnly' | 'anyModel';
export type SuggestionModelTier = 'included' | 'premium' | 'unknown';

export interface SuggestionModelDescriptor {
  id: string;
  label: string;
  tier: SuggestionModelTier;
  pricing?: string;
  provider?: string;
  /** Motor que debe ejecutar esta fila del selector (multi‑fuente). */
  completionSource?: 'copilot' | 'opencode' | 'ollama';
}

export type CompletionResult =
  | {
      kind: 'suggestion';
      suggestion: string;
      model?: SuggestionModelDescriptor;
    }
  | {
      kind: 'empty';
      reason:
        | 'no-model'
        | 'no-included-model'
        | 'premium-quota-blocked'
        | 'empty-response'
        | 'request-timeout'
        | 'too-short'
        | 'duplicate-input'
        | 'rate-limited'
        | 'session-budget-exhausted'
        | 'content-blocked';
    }
  | { kind: 'error'; message: string };

export interface CompletionRequestOptions {
  token: CancellationToken;
  policy: SuggestionModelPolicy;
  preferredModelId?: string;
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
  /** Fase I: correlación en logs `[opencode-perf]` cuando debug está activo (OpenCode ignora si undefined). */
  perfCaptureId?: number;
}

export interface SuggestionContext {
  workspaceName?: string;
  activeFilePath?: string;
  activeLanguageId?: string;
  activeSelection?: string;
  /** Extracto README + resumen package.json (memoria volátil; v0.4 fase A). */
  projectBootstrapLines?: readonly string[];
}
