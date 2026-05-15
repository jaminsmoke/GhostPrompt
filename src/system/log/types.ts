/**
 * @file Tipos canónicos del sistema de logging estructurado.
 */
import type { LogLevelName } from './levels';

/** Migaja de contexto previo a un WARN/ERROR con el mismo `captureId`. */
export type Breadcrumb = {
  level: LogLevelName;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

/** Entrada normalizada enviada a transports. */
export type LogEntry = {
  timestamp: string;
  level: LogLevelName;
  module: string;
  message: string;
  captureId?: number;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  breadcrumbs?: Breadcrumb[];
};

/**
 * Destino de log (canal Output, fichero, etc.).
 */
export type LogTransport = {
  readonly id: string;
  /**
   * Escribe una entrada ya filtrada por `LogManager` según nivel global.
   * @param {LogEntry} entry Entrada completa.
   * @returns {Promise<void>} Flujo async del transporte.
   */
  write(entry: LogEntry): Promise<void>;
  /**
   * Libera recursos del transporte.
   * @returns {Promise<void>} Flujo async de cierre.
   */
  dispose(): Promise<void>;
};
