/**
 * @file Fallos del host: canal GhostPrompt Log canónico y líneas de arranque.
 */
import { isDefined } from '../internals/isDefined';

import {
  appendGhostPromptOutputLine,
  getGhostPromptOutputChannel,
  OutputChannelLogTransport,
} from './transports/outputChannel';

import type { LogEntry } from '../internals/protocols/types/typeLog';

const bootstrapFormatter = new OutputChannelLogTransport();

/**
 * Serializa un error capturado para el canal de log.
 * @param {unknown} cause - Valor de error opcional.
 * @returns {NonNullable<LogEntry['error']> | false} Payload serializable o `false` si no hay causa.
 */
function toHostFaultError(cause: unknown): NonNullable<LogEntry['error']> | false {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  if (!isDefined(cause)) {
    return false;
  }
  if (typeof cause === 'object') {
    return { name: 'Error', message: JSON.stringify(cause) };
  }
  if (typeof cause === 'string') {
    return { name: 'Error', message: cause };
  }
  if (typeof cause === 'number' || typeof cause === 'boolean' || typeof cause === 'bigint') {
    return { name: 'Error', message: cause.toString() };
  }
  if (typeof cause === 'symbol') {
    return { name: 'Error', message: cause.description ?? 'symbol' };
  }
  return { name: 'Error', message: 'unknown' };
}

/**
 * Devuelve el canal **GhostPrompt Log**, creándolo si hace falta.
 * @param {boolean} [preserveFocus] - Si es true, no roba el foco del editor.
 * @returns {import('vscode').OutputChannel} Canal canónico de la extensión.
 */
export function revealGhostPromptLogChannel(preserveFocus = false) {
  const channel = getGhostPromptOutputChannel();
  channel.show(preserveFocus);
  return channel;
}

/**
 * Escribe una línea de arranque sin pasar por el filtro de nivel (bootstrap).
 * @param {string} message - Texto legible.
 * @returns {void}
 */
export function writeGhostPromptLogBootstrap(message: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    module: 'log',
    message,
  };
  appendGhostPromptOutputLine(bootstrapFormatter.formatLine(entry));
}

/**
 * Registra un fallo del host y opcionalmente muestra el canal de salida.
 * @param {string} scope - Módulo o área (`extension`, `ui`, …).
 * @param {string} message - Código de evento.
 * @param {unknown} [cause] - Error original.
 * @param {{ reveal?: boolean }} [options] - Opciones de presentación.
 * @param {boolean} [options.reveal] - Si no es `false`, abre el panel GhostPrompt Log.
 * @returns {void}
 */
export function reportHostFault(
  scope: string,
  message: string,
  cause?: unknown,
  options?: { reveal?: boolean },
): void {
  const errorPayload = toHostFaultError(cause);
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    module: scope,
    message,
  };
  if (errorPayload !== false) {
    entry.error = errorPayload;
  }
  appendGhostPromptOutputLine(bootstrapFormatter.formatLine(entry));
  if (options?.reveal !== false) {
    getGhostPromptOutputChannel().show(true);
  }
}

/**
 * Mensaje corto para notificaciones cuando falla el host.
 * @param {unknown} err - Error capturado.
 * @returns {string} Texto para `showErrorMessage`.
 */
export function formatHostFaultMessage(err: unknown): string {
  if (err instanceof Error) {
    return `GhostPrompt: ${err.message}`;
  }
  return `GhostPrompt: ${String(err)}`;
}

export { GHOSTPROMPT_LOG_CHANNEL_NAME } from '../internals/protocols/constants/consLogLimits';
