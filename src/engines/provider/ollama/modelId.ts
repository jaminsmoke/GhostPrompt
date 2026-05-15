/**
 * @file Heurística de formato de ID de modelo Ollama (`model:tag`).
 */

/**
 * Comprueba si un ID corresponde al formato Ollama (`model:tag`).
 * @param {string} id Identificador de modelo candidato.
 * @returns {boolean} True si el ID contiene dos puntos y no tiene barra.
 */
export function looksLikeOllamaModelId(id: string): boolean {
  return id.includes(':') && !id.includes('/');
}
