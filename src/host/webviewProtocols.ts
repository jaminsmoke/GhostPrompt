/**
 * Validación en límites del canal postMessage (host).
 * Schemas canónicos y tipos inferidos: `src/shared/webviewMessageSchemas.ts`.
 */
import {
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  type WebviewInboundMessage,
} from "../shared/webviewMessageSchemas";
import type { z } from "zod";

export type { WebviewInboundMessage, WebviewSettingsPayload } from "../shared/webviewMessageSchemas";
export {
  suggestionModelDescriptorSchema,
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
  webviewUpdateSettingSchema,
} from "../shared/webviewMessageSchemas";

/**
 * Parsea un mensaje entrante del webview. Si falla el contrato, no debe procesarse
 * (no actualizar `vscode.workspace`).
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
