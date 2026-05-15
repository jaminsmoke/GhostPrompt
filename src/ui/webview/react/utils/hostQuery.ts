/**
 * @file Utils para enviar consultas a través del host del webview.
 */
import type { OutboundMessage } from '../types';

/**
 * Envía un mensaje al host y espera una respuesta específica.
 * @template T
 * @param {OutboundMessage} msg Mensaje outbound enviado al host.
 * @param {string} responseType Tipo de respuesta esperado en el evento de mensaje.
 * @param {(m: OutboundMessage) => void} sendMessage Función para enviar el mensaje outbound al host.
 * @returns {Promise<T>} Promesa con la respuesta deserializada del host.
 */
export function hostQuery<T>(
  msg: OutboundMessage,
  responseType: string,
  sendMessage: (m: OutboundMessage) => void,
): Promise<T> {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      const rawPayload = e.data as unknown;
      if (typeof rawPayload !== 'object' || rawPayload === null) {
        return;
      }
      const payloadWithType = rawPayload as { type: unknown };
      if (typeof payloadWithType.type !== 'string' || payloadWithType.type !== responseType) {
        return;
      }
      window.removeEventListener('message', handler);
      resolve(rawPayload as T);
    };
    window.addEventListener('message', handler);
    sendMessage(msg);
  });
}
