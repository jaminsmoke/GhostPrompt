/**
 * Fuentes de completion habilitadas (`copilot` LM vs OpenCode).
 * Routing puro: elige qué motor debe atender una petición según modelo y fuentes.
 */
import { looksLikeOllamaModelId, looksLikeOpencodeModelId } from '../../../engines/modelIdChecks';

export type CompletionSourceId = 'copilot' | 'opencode' | 'ollama';

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
