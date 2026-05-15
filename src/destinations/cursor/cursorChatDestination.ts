/**
 * @file Destination provider for Cursor Chat, including sendPrompt integration.
 */
import { registerDestination } from '../destinationRegistry';

import { executeCursorChatOpen } from './cursorChatCommands';
import { CURSOR_CHAT_DESTINATION_ID } from './cursorHost';

import type { DestinationProvider } from '../destinationRegistry';

/**
 * Envía el prompt al chat nativo de Cursor (rellena input; el usuario confirma el envío).
 * @param {string} query Texto del prompt.
 * @returns {Promise<void>}
 */
async function sendToCursorChat(query: string): Promise<void> {
  await executeCursorChatOpen(query);
}

const cursorChatProvider: DestinationProvider = {
  id: CURSOR_CHAT_DESTINATION_ID,
  sendPrompt: sendToCursorChat,
};

registerDestination(cursorChatProvider);

export { sendToCursorChat };
