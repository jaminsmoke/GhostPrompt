/**
 * Envío al host validado con el mismo Zod que `parseWebviewInboundMessage` (fase C).
 */
import { webviewInboundMessageSchema } from "../../../src/shared/webviewMessageSchemas";

export type VsCodePostMessageApi = {
  postMessage(message: unknown): void;
};

export function postToHost(api: VsCodePostMessageApi, msg: unknown): void {
  const r = webviewInboundMessageSchema.safeParse(msg);
  if (!r.success) {
    console.warn(
      "[GhostPrompt webview] Mensaje fuera de contrato compartido:",
      r.error.flatten(),
      msg,
    );
    return;
  }
  api.postMessage(r.data);
}
