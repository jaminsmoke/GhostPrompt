/**
 * @file Parseo/validación de mensajes **host → webview** (`postMessage` entrante al panel).
 *
 * Schema canónico: `webviewOutboundMessageSchema` en
 * `system/internals/protocols/validations/schemas/zschemWebviewMessages.ts`.
 *
 * El nombre del archivo es histórico (vista desde el panel: mensaje *inbound* al React);
 * no confundir con `webviewInboundMessageSchema` (webview → host), que vive en
 * `api/boundary/webviewProtocols.ts`.
 */
import { webviewOutboundMessageSchema } from '../webviewProtocolSchemas';

import type { InboundMessage } from '../types';

/**
 * Valida un payload host → webview contra el contrato Zod canónico.
 * @param {unknown} raw - Mensaje sin validar recibido del extension host.
 * @returns {InboundMessage | false} Mensaje tipado o `false` si falla la validación.
 */
export function parseWebviewInboundMessage(raw: unknown): InboundMessage | false {
  const result = webviewOutboundMessageSchema.safeParse(raw);
  if (!result.success) {
    return false;
  }
  return result.data;
}
