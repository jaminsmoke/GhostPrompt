/**
 * @file Tipos y contratos comunes para solicitudes y resultados de completado.
 */
import type { SuggestionStyle } from './typeSuggestionStyle';
import type { SuggestionLoadingPhase } from '../state/loading/stateLoadingPhase';
import type { ProviderId } from '../state/provider/stateProviderId';

/**
 * Token de cancelación mínimo para el pipeline de completion (sin dependencia de `vscode`).
 * Estructuralmente compatible con `vscode.CancellationToken` en el boundary host/engines.
 */
export interface CompletionCancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: (listener: () => void) => { dispose: () => void };
}

export type SuggestionModelPolicy = 'anyModel' | 'nonPremiumOnly';
export type SuggestionModelTier = 'included' | 'premium' | 'unknown';

export interface SuggestionModelDescriptor {
  id: string;
  label: string;
  tier: SuggestionModelTier;
  pricing?: string;
  provider?: string;
  /** Motor que debe ejecutar esta fila del selector (multi‑fuente). */
  completionSource?: ProviderId;
}

export type CompletionResult =
  {
      kind: 'empty';
      reason:
        'content-blocked' | 'duplicate-input' | 'empty-response' | 'no-included-model' | 'no-model' | 'premium-quota-blocked' | 'rate-limited' | 'request-timeout' | 'session-budget-exhausted' | 'too-short';
    } | {
      kind: 'suggestion';
      suggestion: string;
      model?: SuggestionModelDescriptor;
    } | { kind: 'error'; message: string };

export interface CompletionRequestOptions {
  token: CompletionCancellationToken;
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
