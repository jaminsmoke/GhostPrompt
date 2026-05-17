/**
 * @file Validación en límites del canal postMessage (host).
 * Schemas canónicos: `system/internals/protocols/validations/schemas/zschemWebviewMessages.ts`.
 */
import { z } from 'zod';

import {
  
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  
  
  type WebviewInboundMessage,
  type WebviewOutboundMessage,
  
} from '../../system/internals/protocols/validations/schemas/zschemWebviewMessages';
import { getLogger } from '../../system/log';




/**
 * Parsea un mensaje entrante del webview. Si falla el contrato, no debe procesarse
 * (no actualizar `vscode.workspace`).
 * @param {unknown} raw - Datos sin validar recibidos desde el webview.
 * @returns {WebviewInboundMessage | undefined} El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewInboundMessage(raw: unknown): WebviewInboundMessage | undefined {
  const r = webviewInboundMessageSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').warn('webview-inbound-invalid', { issues: z.treeifyError(r.error), raw });
    return undefined;
  }
  return r.data;
}

/**
 * Valida el sobre `{ type: 'settings', settings }` antes de `postMessage`.
 * @param {unknown} raw - Datos sin validar que vienen del host para el payload de settings.
 * @returns {z.infer<typeof webviewOutboundSettingsEnvelopeSchema> | undefined} El objeto parseado o undefined si no pasa la validación Zod.
 */
export function parseOutboundSettingsEnvelope(
  raw: unknown,
): z.infer<typeof webviewOutboundSettingsEnvelopeSchema> | undefined {
  const r = webviewOutboundSettingsEnvelopeSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').error('settings-envelope-invalid', { issues: z.treeifyError(r.error), raw });
    return undefined;
  }
  return r.data;
}

/**
 * Parsea un mensaje saliente hacia el webview. Si falla el contrato,
 * loguea warning (no bloquea el envío en producción).
 * @param {unknown} raw - Datos sin validar que se enviarán al webview.
 * @returns {WebviewOutboundMessage | undefined} El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewOutboundMessage(raw: unknown): WebviewOutboundMessage | undefined {
  const r = webviewOutboundMessageSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').warn('webview-outbound-invalid', { issues: z.treeifyError(r.error), raw });
    return undefined;
  }
  return r.data;
}

export {suggestionModelDescriptorSchema, webviewSettingsPayloadSchema, webviewUpdateSettingSchema, type WebviewSettingsPayload, type WebviewInboundMessage, type WebviewOutboundMessage, webviewInboundMessageSchema, webviewOutboundMessageSchema, webviewOutboundSettingsEnvelopeSchema} from '../../system/internals/protocols/validations/schemas/zschemWebviewMessages';