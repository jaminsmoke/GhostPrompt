/**
 * @file Constantes de destinos del agente GhostPrompt.
 */

export const CURSOR_CHAT_DESTINATION_ID = 'cursorChat' as const;

export const VS_OPEN_CODE_X_EXTENSION_ID = 'jaminsmoke.vsopencodex';

export const AGENT_DESTINATION_IDS = [
  'copilotChat',
  'vsOpenCodeX',
  CURSOR_CHAT_DESTINATION_ID,
] as const;
