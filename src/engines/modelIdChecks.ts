/**
 * Utilidades para validar formatos de identificadores de modelo.
 * @file Validación de formatos de ID de modelo.
 * Comprueba si un ID de modelo corresponde al formato de Ollama (`model:tag`).
 * @param {string} id Identificador de modelo candidato.
 * @returns {boolean} True si el ID contiene dos puntos y no tiene barra.
 */
export function looksLikeOllamaModelId(id: string): boolean {
  return id.includes(':') && !id.includes('/');
}

/**
 * Comprueba si un ID de modelo corresponde al formato de OpenCode (`provider/model`).
 * @param {string} id Identificador de modelo candidato.
 * @returns {boolean} True si el ID contiene exactamente una barra y no es un URL con doble slash.
 */
export function looksLikeOpencodeModelId(id: string): boolean {
  const t = id.trim();
  const slash = t.indexOf('/');
  if (slash <= 0 || slash === t.length - 1) {
    return false;
  }
  return !t.includes('//') && t.split('/').length === 2;
}
