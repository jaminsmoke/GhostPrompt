/**
 * @file Timeouts para comandos CLI y HTTP de Ollama.
 */

/** Timeout para `ollama --version` y `ollama ps`. */
export const OLLAMA_CLI_SHORT_TIMEOUT_MS = 5000;

/** Timeout para operaciones de listado o arranque más lentas. */
export const OLLAMA_CLI_LONG_TIMEOUT_MS = 10_000;

/** Timeout para `ollama pull` de modelos grandes. */
export const OLLAMA_PULL_TIMEOUT_MS = 120_000;
