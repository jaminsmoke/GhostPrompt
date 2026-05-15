/**
 * Post-proceso del texto devuelto por el LM antes de mostrarlo como ghost-text.
 *
 * **Relación con `prompt/instruction.ts`:** El prompt pide no repetir el prefijo y cuándo usar
 * espacio inicial; los modelos incumplen a menudo. Esta capa es **defensiva** y
 * determinista (eco del prefijo, espacio inicial falso en mid-word, tope `maxChars`).
 *
 * @param {string} rawSuggestion Texto devuelto por el LM antes de normalizar.
 * @param {string} userText Texto del usuario que se estaba completando.
 * @param {number} maxChars Número máximo de caracteres permitidos para la sugerencia.
 * @returns {string} Texto normalizado o cadena vacía si no hay sugerencia válida.
 * @see buildCompletionInstruction — directivas de estilo e idioma en el prompt.
 */

/** Palabras cortas que suelen ir tras un espacio tras una palabra completa (no quitar el espacio). */
const KEEP_LEADING_SPACE_PREFIX =
  /^(?:and|or|but|nor|yet|so|if|when|where|while|until|unless|because|although|though|the|a|an|to|for|of|in|on|at|by|with|from|as|is|are|was|were|been|be|have|has|had|do|does|did|will|would|could|should|may|might|must|can|who|what|which|whom|whose|how|why|there|here|not|no|yes|also|too|very|just|only|even|more|most|less|least|much|many|some|any|each|every|both|either|neither|y|o|u|e|ni|pero|sino|que|cual|cuando|donde|como|porque|aunque|mientras|si|el|la|los|las|un|una|unos|unas|de|del|al|en|con|sin|sobre|entre|hacia|desde|hasta|este|esta|estos|estas|ese|esa|esos|esas|mi|tu|su|mis|tus|sus|me|te|se|nos|os|les|lo|le|les|da|dan|hay|ser|es|son|era|eran|fue|fueron|está|están|he|ha|han|hemos|había)\b/iu;

/** Última palabra del borrador: no forzar mid-word si es saludo/token muy común. */
const COMMON_LAST_TOKENS = new Set([
  'hola',
  'hi',
  'hey',
  'ok',
  'yes',
  'no',
  'bye',
  'thanks',
  'please',
  'hello',
  'test',
  'the',
  'a',
  'an',
  'gracias',
  'buenas',
  'adios',
  'vale',
]);

/** Inicio de token que suele ser sufijo morfológico (continúa la palabra previa sin espacio). */
const SUFFIX_CONTINUATION_HEAD =
  /^(?:ing|ed|es|ers?|er|ment|ments|mientos|mente|ación|aciones|iendo|ando|imos|áis|éis|amos|emos|aste|iste|aron|ieron|aría|ería|iría)\b/iu;

const LAST_TOKEN = /(\S+)$/u;
const LETTERS_ONLY = /^[\p{L}]+$/u;

/**
 * Elimina el texto del usuario duplicado al inicio de la sugerencia normalizada.
 * @param {string} normalized Texto ya normalizado de la sugerencia.
 * @param {string} userText Texto actual del usuario que se estaba completando.
 * @returns {string} Sugerencia sin el prefijo duplicado del usuario.
 */
function stripDuplicatedUserPrefix(normalized: string, userText: string): string {
  if (!userText) {
    return normalized;
  }
  if (normalized.startsWith(userText)) {
    return normalized.slice(userText.length);
  }
  const trimmedUser = userText.replace(/\s+$/u, '');
  if (trimmedUser && normalized.startsWith(trimmedUser)) {
    return normalized.slice(trimmedUser.length);
  }
  return normalized;
}

/**
 * Comprueba si el último token termina en un grupo de consonantes que parece una palabra fragmentada.
 * @param {string} lastTok Último token de texto.
 * @returns {boolean} True si el token parece una palabra parcial cortada en medio.
 */
function endsWithMidWordConsonantRun(lastTok: string): boolean {
  const m = lastTok.match(/[bcdfghjklmnpqrstvwxyz]+$/i);
  return m !== null && m[0].length >= 2;
}

/**
 * Corrige el espacio inicial erróneo que el modelo antepone tras un borrador parcial.
 * @param {string} userText Texto actual del usuario.
 * @param {string} normalized Texto normalizado del modelo con posible espacio inicial erróneo.
 * @returns {string} Sugerencia corregida o el texto original si no aplica ninguna regla.
 */
function stripSpuriousLeadingSpaceAfterPartial(userText: string, normalized: string): string {
  if (!userText.trim() || /\s$/u.test(userText) || !normalized.startsWith(' ')) {
    return normalized;
  }
  const rest = normalized.slice(1);
  const firstWord = rest.match(/^\S+/u)?.[0] ?? '';
  if (!firstWord) {
    return normalized;
  }
  if (KEEP_LEADING_SPACE_PREFIX.test(firstWord)) {
    return normalized;
  }
  if (/[.?!:;,…\]}")']\s*$/u.test(userText)) {
    return normalized;
  }
  const lastTok = userText.match(LAST_TOKEN)?.[1] ?? '';
  if (!lastTok || !LETTERS_ONLY.test(lastTok)) {
    return normalized;
  }
  if (COMMON_LAST_TOKENS.has(lastTok.toLowerCase())) {
    return normalized;
  }
  if (SUFFIX_CONTINUATION_HEAD.test(firstWord)) {
    return rest;
  }
  if (firstWord.length >= 8 && lastTok.length <= 4 && endsWithMidWordConsonantRun(lastTok)) {
    return rest;
  }
  return normalized;
}

/**
 * Normaliza la sugerencia devuelta por el modelo para ghost-text.
 * @param {string} rawSuggestion Texto devuelto por el LM antes de normalizar.
 * @param {string} userText Texto del usuario que se estaba completando.
 * @param {number} maxChars Número máximo de caracteres permitidos para la sugerencia.
 * @returns {string} Texto normalizado o cadena vacía si no hay sugerencia válida.
 */
export function normalizeSuggestion(
  rawSuggestion: string,
  userText: string,
  maxChars: number,
): string {
  let normalized = rawSuggestion.replace(/\r\n/g, '\n').trimEnd();

  if (!normalized.trim()) {
    return '';
  }

  normalized = stripDuplicatedUserPrefix(normalized, userText);
  if (!normalized.trim()) {
    return '';
  }

  normalized = stripSpuriousLeadingSpaceAfterPartial(userText, normalized);

  if (!normalized.trim()) {
    return '';
  }

  if (normalized.length > maxChars) {
    normalized = normalized.slice(0, maxChars).trimEnd();
  }

  return normalized;
}
