/**
 * @file Valores predeterminados del pipeline de sugerencias GhostPrompt (límites y timeouts).
 */

/** Máximo de caracteres por sugerencia (por defecto). */
export const DEFAULT_MAX_SUGGESTION_CHARS = 180;

/** Timeout desde que el LM empieza a generar (no incluye setup ni carga de modelo). */
export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 12_000;

/** Mínimo de caracteres no vacíos tras `trim` para invocar al LM (evita ruido y coste). */
export const DEFAULT_MIN_SUGGEST_INPUT_CHARS = 3;

/** Límite inferior al clamp de `ghostPrompt.maxSuggestionChars`. */
export const MIN_MAX_SUGGESTION_CHARS = 40;

/** Límite superior al clamp de `ghostPrompt.maxSuggestionChars`. */
export const MAX_MAX_SUGGESTION_CHARS = 500;

/** Debounce por defecto entre tecleo y petición de sugerencia (ms). */
export const DEFAULT_SUGGESTION_DEBOUNCE_MS = 800;

/** Mínimo permitido para `ghostPrompt.suggestionDebounceMs`. */
export const MIN_SUGGESTION_DEBOUNCE_MS = 150;

/** Máximo permitido para `ghostPrompt.suggestionDebounceMs`. */
export const MAX_SUGGESTION_DEBOUNCE_MS = 2000;

/** Altura mínima del textarea del webview (px). */
export const WEBVIEW_TEXTAREA_MIN_HEIGHT_PX = 120;

/** Altura mínima del textarea en modo compacto (px). */
export const WEBVIEW_TEXTAREA_COMPACT_MIN_HEIGHT_PX = 80;

/** Caracteres de texto enviados en logs de depuración del webview. */
export const WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS = 40;

/** Antigüedad de caché de estado de proveedores en el webview (ms). */
export const WEBVIEW_PROVIDER_STATUS_STALE_MS = 30_000;
