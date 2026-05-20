/**
 * @file Límite de longitud de texto de suggestion (transporte; sin normalización semántica).
 */

/**
 * Recorta el texto al máximo de caracteres permitido.
 * @param {string} text - Texto devuelto por el LM.
 * @param {number} maxChars - Tope de caracteres.
 * @returns {string} Texto acotado (sin trim ni reformateo).
 */
export function boundSuggestionText(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return '';
  }
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}
