/**
 * @file Enrutamiento de solicitudes de completado según fuente y modelo.
 *
 * Selecciona la fuente de completado (`copilot`, `opencode`, `ollama`) en función del
 * modelo solicitado y de las fuentes habilitadas por configuración.
 */
import { looksLikeOllamaModelId, looksLikeOpencodeModelId } from '../modelIdChecks';

import type { CompletionSourceId } from '../completionSourceId';

/**
 * Decide qué fuente de completado usar para una petición dada.
 * @param {string} selectedModelId Modelo seleccionado o `auto`.
 * @param {readonly CompletionSourceId[]} enabledSources Fuentes disponibles en la configuración activa.
 * @returns {CompletionSourceId} Fuente de completado que debe atender la petición.
 */
export function resolveCompletionSourceForRequest(
  selectedModelId: string,
  enabledSources: readonly CompletionSourceId[],
): CompletionSourceId {
  if (enabledSources.length === 1) {
    return enabledSources[0];
  }
  if (selectedModelId === 'auto') {
    if (enabledSources.includes('copilot')) {
      return 'copilot';
    }
    if (enabledSources.includes('opencode')) {
      return 'opencode';
    }
    return 'ollama';
  }
  if (enabledSources.includes('ollama') && looksLikeOllamaModelId(selectedModelId)) {
    return 'ollama';
  }
  if (enabledSources.includes('opencode') && looksLikeOpencodeModelId(selectedModelId)) {
    return 'opencode';
  }
  if (enabledSources.includes('copilot')) {
    return 'copilot';
  }
  if (enabledSources.includes('opencode')) {
    return 'opencode';
  }
  return 'ollama';
}
