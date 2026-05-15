/**
 * @file Logger por módulo (`module` estable en NDJSON).
 */
import type { LogEmitSink } from './emitContract';

/**
 * API de logging por módulo canónico (`suggest`, `inbound`, …).
 * Cada método delega en el sink con el `moduleName` fijado en la construcción.
 */
export class Logger {
  /**
   * Crea un logger ligado a un módulo estable y a un sink de emisión.
   * @param {string} moduleName Nombre estable del módulo (aparece en `LogEntry.module`).
   * @param {LogEmitSink} sink Gestor que materializa `LogEntry` y despacha.
   */
  constructor(
    private readonly moduleName: string,
    private readonly sink: LogEmitSink,
  ) {}

  /**
   * Emite un evento de depuración si el nivel configurado lo permite.
   * @param {string} message Código de evento (por ejemplo, `request-start`).
   * @param {Record<string, unknown>} [data] Metadatos; puede incluir `captureId`.
   * @returns {void} Sin valor de retorno.
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.sink.emit({ level: 'DEBUG', module: this.moduleName, message, data });
  }

  /**
   * Emite un evento informativo si el nivel configurado lo permite.
   * @param {string} message Código de evento.
   * @param {Record<string, unknown>} [data] Metadatos; puede incluir `captureId`.
   * @returns {void} Sin valor de retorno.
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.sink.emit({ level: 'INFO', module: this.moduleName, message, data });
  }

  /**
   * Emite una advertencia si el nivel configurado lo permite.
   * @param {string} message Código de evento.
   * @param {Record<string, unknown>} [data] Metadatos; puede incluir `captureId`.
   * @returns {void} Sin valor de retorno.
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.sink.emit({ level: 'WARN', module: this.moduleName, message, data });
  }

  /**
   * Emite un error si el nivel configurado lo permite.
   * @param {string} message Código de evento.
   * @param {Record<string, unknown>} [data] Metadatos; puede incluir `captureId`.
   * @param {unknown} [cause] Error u objeto lanzado.
   * @returns {void} Sin valor de retorno.
   */
  error(message: string, data?: Record<string, unknown>, cause?: unknown): void {
    this.sink.emit({ level: 'ERROR', module: this.moduleName, message, data, cause });
  }
}
