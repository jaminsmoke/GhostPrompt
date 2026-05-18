/**
 * @file Fallos del host: canal GhostPrompt Log canónico y líneas de arranque.
 */
import {
  appendGhostPromptOutputLine,
  getGhostPromptOutputChannel,
  OutputChannelLogTransport,
} from './transports/outputChannel';

import type { LogEntry } from '../internals/protocols/types/typeLog';
import type { OutputChannel } from 'vscode';

const bootstrapFormatter = new OutputChannelLogTransport();

/**
 * @param {unknown} cause - Valor de error opcional.
 * @returns {NonNullable<LogEntry['error']> | null} Payload serializable o null.
 */
function toHostFaultError(cause: unknown): NonNullable<LogEntry['error']> | null {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  if (cause === null || cause === undefined) {
    return null;
  }
  return { name: 'Error', message: String(cause) };
}

/**
 * Devuelve el canal **GhostPrompt Log**, creándolo si hace falta.
 * @param {boolean} [preserveFocus] - Si es true, no roba el foco del editor.
 * @returns {OutputChannel} Canal canónico de la extensión.
 */
export function revealGhostPromptLogChannel(preserveFocus = false): OutputChannel {
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
 * @param {{ reveal?: boolean }} [options] - Opciones; si `reveal` no es false, abre GhostPrompt Log.
 * @param options.reveal
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
    ...errorPayload === null ? {} : { error: errorPayload },
  };
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
