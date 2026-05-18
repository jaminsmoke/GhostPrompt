/**
 * @file Límites numéricos del subsistema de logging.
 */

/** Vista previa máxima al migrar ficheros Markdown legacy. */
export const LOG_LEGACY_MD_PREVIEW_MAX_CHARS = 4000;

/** Tamaño máximo del fichero NDJSON antes de rotar (5 MiB). */
export const LOG_FILE_ROTATE_MAX_BYTES = 5_242_880;

/** Entradas recientes retenidas en el canal de salida. */
export const LOG_OUTPUT_CHANNEL_RING_SIZE = 3;
