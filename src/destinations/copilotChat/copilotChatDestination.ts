import * as vscode from 'vscode';
import type { DestinationProvider } from '../destinationRegistry';
import { registerDestination } from '../destinationRegistry';

/**
 * Envía una query al chat de VS Code como prompt inicial.
 * @param {string} query Texto de la petición que se abrirá en el chat.
 * @returns {Promise<void>} Promise que se resuelve cuando el comando de chat se ejecuta.
 */
async function sendToChat(query: string): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.chat.open', { query });
}

const copilotChatProvider: DestinationProvider = {
  id: 'copilotChat',
  sendPrompt: sendToChat,
};

registerDestination(copilotChatProvider);

export { sendToChat };
