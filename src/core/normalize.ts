/**
 * Post-proceso del texto devuelto por el LM antes de mostrarlo como ghost-text.
 *
 * **Relación con `instruction.ts`:** el prompt ya pide no repetir el prefijo y cuándo
 * usar espacio inicial; los modelos incumplen a menudo. Esta capa es **defensiva** y
 * determinista (prefijo repetido, solape sufijo/prefijo, espacio tras `.:;,!?`, tope
 * `maxChars`). No sustituye a la instrucción: reduce tokens rotos en la UI y evita
 * depender solo del cumplimiento del modelo.
 *
 * @param rawSuggestion Texto devuelto por el LM antes de normalizar.
 * @param userText Texto del usuario que se estaba completando.
 * @param maxChars Número máximo de caracteres permitidos para la sugerencia.
 * @returns Texto normalizado o cadena vacía si no hay sugerencia válida.
 * @see buildCompletionInstruction — directivas de estilo e idioma en el prompt.
 */
export function normalizeSuggestion(
  rawSuggestion: string,
  userText: string,
  maxChars: number,
): string {
  let normalized = rawSuggestion.replace(/\r\n/g, "\n").trimEnd();
  const prefix = userText.trim();

  if (!normalized) {
    return "";
  }

  if (prefix && normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
    normalized = normalized.slice(prefix.length);
    /* No trimStart: la continuación suele empezar con espacio o \n respecto a la última palabra. */
  } else if (prefix) {
    const overlap = findSuffixPrefixOverlap(prefix, normalized);
    if (overlap > 0) {
      normalized = normalized.slice(overlap);
    } else {
      const trailingWord = getTrailingWord(prefix);
      if (
        trailingWord.length >= 3 &&
        normalized.toLowerCase().startsWith(trailingWord.toLowerCase())
      ) {
        normalized = normalized.slice(trailingWord.length);
      }
    }
  }

  if (!normalized.trim()) {
    return "";
  }

  if (shouldInsertSpaceAfterPunctuation(userText, normalized)) {
    normalized = ` ${normalized}`;
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}

/**
 * Determina si se debe insertar un espacio delante de la continuación.
 * @param userText Texto original del usuario que se está completando.
 * @param suggestion Texto sugerido por el modelo, ya normalizado.
 * @returns True si se debe agregar un espacio entre userText y la sugerencia.
 */
function shouldInsertSpaceAfterPunctuation(userText: string, suggestion: string): boolean {
  if (!suggestion) {
    return false;
  }
  const first = suggestion[0];
  if (/\s/.test(first)) {
    return false;
  }
  if (!/[\p{L}\p{N}_]/u.test(first)) {
    return false;
  }
  if (/\s$/.test(userText)) {
    return false;
  }
  const last = getLastNonWhitespaceChar(userText);
  if (!last) {
    return false;
  }
  return /[:;,.!?]/.test(last);
}

/**
 * Devuelve el último carácter no espacio en blanco de un texto.
 * @param text Texto donde buscar el carácter.
 * @returns El último carácter no espacio en blanco, o cadena vacía si no hay ninguno.
 */
function getLastNonWhitespaceChar(text: string): string {
  const trimmed = text.replace(/\s+$/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed[trimmed.length - 1];
}

/**
 * Calcula el largo del solapamiento entre el sufijo de la primera cadena
 * y el prefijo de la segunda.
 * @param left Cadena izquierda usada como sufijo.
 * @param right Cadena derecha usada como prefijo.
 * @returns Longitud del solapamiento encontrado, o 0 si no hay ninguno.
 */
function findSuffixPrefixOverlap(left: string, right: string): number {
  const leftLower = left.toLowerCase();
  const rightLower = right.toLowerCase();
  const max = Math.min(leftLower.length, rightLower.length, 80);
  for (let len = max; len >= 3; len -= 1) {
    if (leftLower.slice(-len) === rightLower.slice(0, len)) {
      return len;
    }
  }
  return 0;
}

/**
 * Extrae la última palabra o token de un texto.
 * @param text Texto de entrada para la extracción.
 * @returns Última palabra o cadena vacía si no existe ninguna.
 */
function getTrailingWord(text: string): string {
  const match = text.match(/[\p{L}\p{N}_]+$/u);
  return match?.[0] ?? "";
}
