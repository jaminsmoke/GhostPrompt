/**
 * @file Discriminantes `type` de mensajes UI host→webview reenviables a VSOpenCodeX vía comando.
 */

/**
 * Discriminantes `type` permitidos para el reenvío cuando `ghostPrompt.agentDestination` es VSOpenCodeX.
 * Alineados con los mensajes outbound de suggest/stream (`loading`, `suggestion`, etc.).
 */
export const OUTBOUND_UI_FORWARD_KINDS = [
  'loading',
  'suggestion-stream',
  'suggestion',
  'empty',
  'error',
  'clear',
] as const;

/** Unión de tipos de mensaje UI reenviables a VSOpenCodeX. */
export type OutboundUiForwardKind = (typeof OUTBOUND_UI_FORWARD_KINDS)[number];
