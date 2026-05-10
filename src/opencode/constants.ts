/**
 * Dedicated localhost port for GhostPrompt's embedded OpenCode server.
 * Avoids default OpenCode / dev ports (e.g. 4096) so another user OpenCode instance can coexist.
 */
export const GHOST_PROMPT_OPENCODE_PORT = 17433;

export const OPENCODE_CLI_CACHE_TTL_MS = 5 * 60 * 1000;

/** Timeout for `opencode --version` probe (spawn). */
export const OPENCODE_CLI_PROBE_TIMEOUT_MS = 5000;

/**
 * Tras cambiar el proveedor a Copilot, el servidor OpenCode embebido se detiene
 * tras esta espera (evita cold start si el usuario alterna motor con rapidez).
 */
export const OPENCODE_STOP_DEBOUNCE_MS = 45_000;

/** No repetir warm-up (start + ping) al abrir vistas GhostPrompt más seguido que esto. */
export const OPENCODE_WARM_THROTTLE_MS = 20_000;
