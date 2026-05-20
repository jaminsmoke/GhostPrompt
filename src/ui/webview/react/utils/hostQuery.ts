/**
 * @file Utils para enviar consultas a través del host del webview.
 */
import type { OutboundMessage } from '../types';

/**
 * Envía un mensaje al host y espera una respuesta específica.
 * @template T
 * @param {OutboundMessage} msg - Mensaje outbound enviado al host.
 * @param {string} responseType - Tipo de respuesta esperado en el evento de mensaje.
 * @param {(m: OutboundMessage) => void} sendMessage - Función para enviar el mensaje outbound al host.
 * @param {number} [timeoutMs] - Tiempo máximo de espera en milisegundos (por defecto 15000).
 * @returns {Promise<T | undefined>} Promesa con la respuesta o sin valor si expira el timeout.
 */
export function hostQuery<T>(
  msg: OutboundMessage,
  responseType: string,
  sendMessage: (m: OutboundMessage) => void,
  timeoutMs = 15_000,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const finish = (value?: T): void => {
      resolve(value);
    };
    const queryTimer: { id?: ReturnType<typeof setTimeout> } = {};
    const handler = (e: MessageEvent) => {
      const rawPayload = e.data as unknown;
      if (typeof rawPayload !== 'object' || !rawPayload) {
        return;
      }
      const payloadWithType = rawPayload as { type: unknown };
      if (typeof payloadWithType.type !== 'string' || payloadWithType.type !== responseType) {
        return;
      }
      window.removeEventListener('message', handler);
      if (queryTimer.id) {
        clearTimeout(queryTimer.id);
      }
      finish(rawPayload as T);
    };
    queryTimer.id = setTimeout(() => {
      window.removeEventListener('message', handler);
      finish();
    }, timeoutMs);
    window.addEventListener('message', handler);
    sendMessage(msg);
  });
}
