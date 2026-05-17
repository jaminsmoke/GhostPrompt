/**
 * @file Enrutamiento de solicitudes de completado según fuente y modelo.
 *
 * Selecciona la fuente de completado (`copilot`, `opencode`, `ollama`) en función del
 * modelo solicitado y de las fuentes habilitadas por configuración.
 */
import { looksLikeOllamaModelId } from '../provider/ollama/routing/routingModelId';
import { looksLikeOpencodeModelId } from '../provider/opencode/routingModelId';

import type { ProviderId } from '../../system/internals/protocols/state/provider';

/**
 * Decide qué proveedor LM debe atender una petición.
 * @param {string} selectedModelId - Modelo seleccionado o `auto`.
 * @param {readonly ProviderId[]} enabledSources - Proveedores habilitados en configuración.
 * @returns {ProviderId} Proveedor que debe atender la petición.
 */
export function resolveCompletionSourceForRequest(
  selectedModelId: string,
  enabledSources: readonly ProviderId[],
): ProviderId {
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
