/**
 * @file Constantes de conexión y timeouts del cliente SDK OpenCode.
 */

/** Puerto HTTP por defecto del servidor OpenCode headless. */
export const OPENCODE_DEFAULT_PORT = 4096;

/** Timeout del health check HTTP al arrancar OpenCode. */
export const OPENCODE_HEALTH_CHECK_TIMEOUT_MS = 2000;

/** Intervalo entre reintentos de health al iniciar el servidor. */
export const OPENCODE_START_POLL_INTERVAL_MS = 1000;

/** Índice del último intento de arranque (30 intentos: 0…29). */
export const OPENCODE_START_LAST_ATTEMPT_INDEX = 29;

/** Timeout de la petición POST `/exit` al detener OpenCode. */
export const OPENCODE_EXIT_REQUEST_TIMEOUT_MS = 3000;
