/**
 * @file Logging estructurado desde el webview al host.
 */
import { postToHost } from './ghostPromptPostMessage';

/**
 * Envía un evento de log estructurado desde el webview al host.
 * @param {'debug' | 'error' | 'info' | 'warn'} level - Nivel del log.
 * @param {string} message - Mensaje principal.
 * @param {Record<string, unknown> | undefined} [data] - Datos adicionales opcionales.
 * @param {number | undefined} [captureId] - ID de capture opcional para correlación.
 * @returns {void}
 */
export function logToHost(
  level: 'debug' | 'error' | 'info' | 'warn',
  message: string,
  data?: Record<string, unknown>,
  captureId?: number,
): void {
  postToHost({ type: 'log', level, message, data, captureId });
}
