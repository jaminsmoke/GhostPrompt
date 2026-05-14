import type { OutboundMessage } from '../types';

/**
 * Envía un mensaje al host y espera una respuesta específica.
 * @param msg Mensaje outbound enviado al host.
 * @param responseType Tipo de respuesta esperado en el evento de mensaje.
 * @param sendMessage Función para enviar el mensaje outbound al host.
 * @returns Promesa con la respuesta deserializada del host.
 */
export function hostQuery<T>(
  msg: OutboundMessage,
  responseType: string,
  sendMessage: (m: OutboundMessage) => void,
): Promise<T> {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === responseType) {
        window.removeEventListener('message', handler);
        resolve(e.data as T);
      }
    };
    window.addEventListener('message', handler);
    sendMessage(msg);
  });
}
