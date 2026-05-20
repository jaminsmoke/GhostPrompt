/**
 * @file Etiquetas derivadas e hints LM por longitud de pre-suggestion.
 */
import {
  MAX_MAX_SUGGESTION_CHARS,
  MIN_MAX_SUGGESTION_CHARS,
} from '../constants/consPipelineDefaults';
import {
  SUGGESTION_LENGTH_BAND_MAX_CHARS,
  SUGGESTION_LENGTH_LABELS,
  type SuggestionLengthLabel,
} from '../constants/consSuggestionLength';

const INSTRUCTION_HINTS: Record<SuggestionLengthLabel, string> = {
  'Muy conciso':
    'Keep the continuation extremely short (a few words or one very brief phrase only).',
  Conciso: 'Keep the continuation short (about one brief phrase or clause).',
  Normal: 'Keep the continuation practical and context-appropriate in length.',
  Extenso: 'You may continue with multiple sentences if it fits naturally.',
  'Muy extenso':
    'You may continue at length with several sentences when it fits the context naturally.',
};

/**
 * Acota un valor al rango de producto para `maxSuggestionChars`.
 * @param {number} raw - Valor crudo.
 * @returns {number} Entero dentro de [MIN_MAX_SUGGESTION_CHARS, MAX_MAX_SUGGESTION_CHARS].
 */
export function clampMaxSuggestionChars(raw: number): number {
  if (!Number.isFinite(raw)) {
    return MIN_MAX_SUGGESTION_CHARS;
  }
  return Math.max(
    MIN_MAX_SUGGESTION_CHARS,
    Math.min(MAX_MAX_SUGGESTION_CHARS, Math.floor(raw)),
  );
}

/**
 * Deriva la etiqueta UX a partir del tope de caracteres (no persistida).
 * @param {number} chars - `maxSuggestionChars` efectivo.
 * @returns {SuggestionLengthLabel} Etiqueta de banda.
 */
export function deriveSuggestionLengthLabel(chars: number): SuggestionLengthLabel {
  const clamped = clampMaxSuggestionChars(chars);
  const bandIndex = SUGGESTION_LENGTH_BAND_MAX_CHARS.findIndex((max) => clamped <= max);
  const safeIndex = bandIndex === -1 ? SUGGESTION_LENGTH_LABELS.length - 1 : bandIndex;
  return SUGGESTION_LENGTH_LABELS[safeIndex];
}

/**
 * Hint de longitud para `buildCompletionInstruction` según el tope configurado.
 * @param {number} maxChars - Tope de caracteres de la suggestion.
 * @returns {string} Frase guía para el LM.
 */
export function instructionHintForMaxChars(maxChars: number): string {
  const label = deriveSuggestionLengthLabel(maxChars);
  return INSTRUCTION_HINTS[label];
}
