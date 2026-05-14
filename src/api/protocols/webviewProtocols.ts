/**
 * Validación en límites del canal postMessage (host).
 * Schemas canónicos y tipos inferidos: `src/system/contracts/webviewMessageSchemas.ts`.
 */
import {
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  type WebviewInboundMessage,
  type WebviewOutboundMessage,
} from '../../system/contracts/webviewMessageSchemas';
import type { z } from "zod";

export type { WebviewInboundMessage, WebviewOutboundMessage, WebviewSettingsPayload } from '../../system/contracts/webviewMessageSchemas';
export {
  suggestionModelDescriptorSchema,
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
  webviewUpdateSettingSchema,
} from '../../system/contracts/webviewMessageSchemas';

/**
 * Parsea un mensaje entrante del webview. Si falla el contrato, no debe procesarse
 * (no actualizar `vscode.workspace`).
 * @param raw
 * @returns El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewInboundMessage(
  raw: unknown,
): WebviewInboundMessage | undefined {
  const r = webviewInboundMessageSchema.safeParse(raw);
  if (!r.success) {
    console.warn(
      "[GhostPrompt] Mensaje webview inválido:",
      r.error.flatten(),
      raw,
    );
    return undefined;
  }
  return r.data;
}

/**
 * Valida el sobre `{ type: 'settings', settings }` antes de `postMessage`.
 * @param raw
 * @returns el objeto parseado (misma forma, posiblemente normalizada por Zod).
 */
export function parseOutboundSettingsEnvelope(
  raw: unknown,
): z.infer<typeof webviewOutboundSettingsEnvelopeSchema> | undefined {
  const r = webviewOutboundSettingsEnvelopeSchema.safeParse(raw);
  if (!r.success) {
    console.error(
      "[GhostPrompt] Payload `settings` inválido (host):",
      r.error.flatten(),
      raw,
    );
    return undefined;
  }
  return r.data;
}

/**
 * Parsea un mensaje saliente hacia el webview. Si falla el contrato,
 * loguea warning (no bloquea el envío en producción).
 * @param raw
 * @returns El mensaje parseado o undefined si no pasa la validación Zod.
 */
export function parseWebviewOutboundMessage(
  raw: unknown,
): WebviewOutboundMessage | undefined {
  const r = webviewOutboundMessageSchema.safeParse(raw);
  if (!r.success) {
    console.warn(
      "[GhostPrompt] Mensaje saliente inválido:",
      r.error.flatten(),
      raw,
    );
    return undefined;
  }
  return r.data;
}
