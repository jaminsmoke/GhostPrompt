/**
 * Validación en límites del canal postMessage (host).
 * Schemas canónicos y tipos inferidos: `src/api/contracts/webviewMessageSchemas.ts`.
 */
import {
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  type WebviewInboundMessage,
  type WebviewOutboundMessage,
} from '../contracts/webviewMessageSchemas';
import { getLogger } from '../../system/log';
import type { z } from 'zod';

export type {
  WebviewInboundMessage,
  WebviewOutboundMessage,
  WebviewSettingsPayload,
} from '../contracts/webviewMessageSchemas';
export {
  suggestionModelDescriptorSchema,
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
  webviewUpdateSettingSchema,
} from '../contracts/webviewMessageSchemas';

/**
 * Parsea un mensaje entrante del webview. Si falla el contrato, no debe procesarse
 * (no actualizar `vscode.workspace`).
 * @param {unknown} raw Datos sin validar recibidos desde el webview.
 * @returns {WebviewInboundMessage | undefined} El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewInboundMessage(raw: unknown): WebviewInboundMessage | undefined {
  const r = webviewInboundMessageSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').warn('webview-inbound-invalid', { issues: r.error.flatten(), raw });
    return undefined;
  }
  return r.data;
}

/**
 * Valida el sobre `{ type: 'settings', settings }` antes de `postMessage`.
 * @param {unknown} raw Datos sin validar que vienen del host para el payload de settings.
 * @returns {z.infer<typeof webviewOutboundSettingsEnvelopeSchema> | undefined} El objeto parseado o undefined si no pasa la validación Zod.
 */
export function parseOutboundSettingsEnvelope(
  raw: unknown,
): z.infer<typeof webviewOutboundSettingsEnvelopeSchema> | undefined {
  const r = webviewOutboundSettingsEnvelopeSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').error('settings-envelope-invalid', { issues: r.error.flatten(), raw });
    return undefined;
  }
  return r.data;
}

/**
 * Parsea un mensaje saliente hacia el webview. Si falla el contrato,
 * loguea warning (no bloquea el envío en producción).
 * @param {unknown} raw Datos sin validar que se enviarán al webview.
 * @returns {WebviewOutboundMessage | undefined} El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewOutboundMessage(raw: unknown): WebviewOutboundMessage | undefined {
  const r = webviewOutboundMessageSchema.safeParse(raw);
  if (!r.success) {
    getLogger('protocols').warn('webview-outbound-invalid', { issues: r.error.flatten(), raw });
    return undefined;
  }
  return r.data;
}
