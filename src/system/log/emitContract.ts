/**
 * @file Contrato de emisión entre la clase `Logger` y el singleton `LogManager`.
 */
import type { LogLevelName } from './levels';

/** Carga cruda antes de construir `LogEntry` (breadcrumbs, timestamp, error). */
export type EmitPayload = {
  level: LogLevelName;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  cause?: unknown;
};

/**
 * Destino interno al que la clase `Logger` envía eventos.
 */
export type LogEmitSink = {
  /**
   * @param {EmitPayload} payload - Carga del evento.
   * @returns {void} Void.
   */
  emit: (payload: EmitPayload) => void;
};
