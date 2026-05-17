/**
 * @file Niveles de log: orden de severidad y helpers sin dependencia de VS Code.
 */

/** Etiqueta serializada en `LogEntry` / NDJSON. */
export type LogLevelName = 'DEBUG' | 'ERROR' | 'INFO' | 'WARN';

/** Orden creciente de “verbosidad” (ERROR es el más restrictivo al filtrar por defecto). */
export const LOG_LEVEL_ORDER: readonly LogLevelName[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'] as const;

/**
 * Convierte una cadena de configuración (`ghostPrompt.logLevel`) a `LogLevelName`.
 * @param {string | undefined} raw - Valor en minúsculas o mezcla; por defecto `info`.
 * @returns {LogLevelName} Nivel canónico.
 */
export function parseLogLevelString(raw: string | undefined): LogLevelName {
  const n = (raw ?? 'info').toLowerCase();
  if (n === 'error') {
    return 'ERROR';
  }
  if (n === 'warn') {
    return 'WARN';
  }
  if (n === 'debug') {
    return 'DEBUG';
  }
  return 'INFO';
}

/**
 * Índice del nivel en {@link LOG_LEVEL_ORDER}.
 * @param {LogLevelName} level - Nivel a indexar.
 * @returns {number} Índice 0..3.
 */
export function levelIndex(level: LogLevelName): number {
  return LOG_LEVEL_ORDER.indexOf(level);
}

/**
 * Indica si una entrada con `entryLevel` debe emitirse cuando el umbral mínimo es `minLevel`.
 * @param {LogLevelName} entryLevel - Severidad del evento.
 * @param {LogLevelName} minLevel - Umbral mínimo configurado (por ejemplo, `INFO` excluye solo `DEBUG`).
 * @returns {boolean} Verdadero si el evento debe mostrarse o persistirse.
 */
export function shouldEmit(entryLevel: LogLevelName, minLevel: LogLevelName): boolean {
  return levelIndex(entryLevel) <= levelIndex(minLevel);
}
