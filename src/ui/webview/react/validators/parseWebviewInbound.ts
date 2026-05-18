/**
 * @file Parseo/validación de mensajes host → webview (`postMessage` entrante al panel).
 * Schemas canónicos: `system/internals/protocols/validations/schemas/zschemWebviewMessages.ts`.
 */
import { webviewOutboundMessageSchema } from '../../../../system/internals/protocols/validations/schemas/zschemWebviewMessages';

import type { InboundMessage } from '../types';

/** Alias local para que ESLint resuelva el schema; typecheck ya valida el canónico. */
type InboundParseResult =
  | { success: false }
  | { success: true; data: InboundMessage };

const webviewInboundMessageSchema: {
  safeParse: (raw: unknown) => InboundParseResult;
} = webviewOutboundMessageSchema;

/**
 * Valida un payload host → webview contra el contrato Zod canónico.
 * @param {unknown} raw - Mensaje sin validar recibido del extension host.
 * @returns {InboundMessage | undefined} Mensaje tipado o `undefined` si falla la validación.
 */
export function parseWebviewInboundMessage(raw: unknown): InboundMessage | false {
  const result = webviewInboundMessageSchema.safeParse(raw);
  if (!result.success) {
    return false;
  }
  return result.data;
}
