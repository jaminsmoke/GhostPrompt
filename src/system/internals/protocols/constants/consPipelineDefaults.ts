/**
 * @file Valores predeterminados del pipeline de sugerencias GhostPrompt (límites y timeouts).
 */

/** Máximo de caracteres por sugerencia (por defecto). */
export const DEFAULT_MAX_SUGGESTION_CHARS = 180;

/** Timeout desde que el LM empieza a generar (no incluye setup ni carga de modelo). */
export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 12_000;

/** Mínimo de caracteres no vacíos tras `trim` para invocar al LM (evita ruido y coste). */
export const DEFAULT_MIN_SUGGEST_INPUT_CHARS = 3;
