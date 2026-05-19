/**
 * @file Post-procesado del resultado crudo del motor LM antes del broadcast.
 *
 * Modo diagnóstico v0.6.2 (colocación ghost): passthrough sin acotación ni heurística de rechazo.
 * Reintroducir `boundSuggestionText` / `looksLikeCopilotRefusal` cuando el formato crudo esté validado.
 */
import type { CompletionResult } from '../internals/protocols/types';

/**
 * Devuelve el resultado del motor sin transformar el texto de suggestion (solo vacío explícito).
 * @param {CompletionResult} result - Resultado tal cual devuelve `EngineProvider.requestCompletion`.
 * @param {number} [_maxSuggestionChars] - Reservado; sin efecto en modo passthrough.
 * @returns {CompletionResult} Mismo resultado o `empty-response` si la suggestion es cadena vacía.
 */
export function finalizeEngineCompletionResult(
  result: CompletionResult,
  _maxSuggestionChars?: number,
): CompletionResult {
  if (result.kind !== 'suggestion') {
    return result;
  }
  if (result.suggestion.length === 0) {
    return { kind: 'empty', reason: 'empty-response' };
  }
  return result;
}
