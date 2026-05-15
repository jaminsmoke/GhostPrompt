/**
 * @file Heurística de forma de id de modelo para enrutado OpenCode (`provider/model`).
 */

/**
 * Comprueba si un ID corresponde al formato OpenCode (`provider/model`).
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
