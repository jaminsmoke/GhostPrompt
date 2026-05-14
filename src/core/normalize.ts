/**
 * Post-proceso del texto devuelto por el LM antes de mostrarlo como ghost-text.
 *
 * **Relación con `instruction.ts`:** el prompt ya pide no repetir el prefijo y cuándo
 * usar espacio inicial; los modelos incumplen a menudo. Esta capa es **defensiva** y
 * determinista (prefijo repetido, tope `maxChars`). No sustituye a la instrucción:
 * reduce tokens rotos en la UI y evita depender solo del cumplimiento del modelo.
 *
 * @param {string} rawSuggestion Texto devuelto por el LM antes de normalizar.
 * @param {string} _userText Texto del usuario que se estaba completando.
 * @param {number} maxChars Número máximo de caracteres permitidos para la sugerencia.
 * @returns {string} Texto normalizado o cadena vacía si no hay sugerencia válida.
 * @see buildCompletionInstruction — directivas de estilo e idioma en el prompt.
 */
export function normalizeSuggestion(
  rawSuggestion: string,
  _userText: string,
  maxChars: number,
): string {
  let normalized = rawSuggestion.replace(/\r\n/g, "\n").trimEnd();

  if (!normalized.trim()) {
    return "";
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}