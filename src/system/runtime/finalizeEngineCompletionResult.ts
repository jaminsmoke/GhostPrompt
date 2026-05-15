/**
 * @file Post-procesado del resultado crudo del motor LM antes del broadcast (acotación y rechazo).
 */
import { looksLikeCopilotRefusal } from '../internals/protocols/guards/copilotLm';
import { boundSuggestionText } from '../internals/protocols/types/boundSuggestionText';
import { DEFAULT_MAX_SUGGESTION_CHARS } from '../internals/protocols/types/params';

import type { CompletionResult } from '../internals/protocols/types';

/**
 * Aplica límites de producto al texto devuelto por el motor (sin mutar vacíos ni errores).
 * @param {CompletionResult} result Resultado tal cual devuelve `EngineProvider.requestCompletion`.
 * @param {number} [maxSuggestionChars] Tope de caracteres para la sugerencia enviada al webview.
 * @returns {CompletionResult} Resultado listo para UI y logs.
 */
export function finalizeEngineCompletionResult(
  result: CompletionResult,
  maxSuggestionChars: number = DEFAULT_MAX_SUGGESTION_CHARS,
): CompletionResult {
  if (result.kind !== 'suggestion') {
    return result;
  }
  const raw = result.suggestion;
  if (looksLikeCopilotRefusal(raw)) {
    return { kind: 'empty', reason: 'content-blocked' };
  }
  const bounded = boundSuggestionText(raw, maxSuggestionChars);
  if (!bounded) {
    return { kind: 'empty', reason: 'empty-response' };
  }
  return { ...result, suggestion: bounded };
}
