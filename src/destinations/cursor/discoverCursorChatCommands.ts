/**
 * Comando de desarrollo: lista comandos candidatos para chat/composer en Cursor.
 */
import * as vscode from 'vscode';
import { appendCursorChatCommandDiscovery } from './cursorChatCommands';
import { ensureSuggestionDebugChannel } from '../../system/log';
import { GHOSTPROMPT_LOG_CHANNEL_NAME } from '../../system/log/transports/outputChannel';

/**
 * Registra `ghostPrompt.discoverCursorChatCommands` (paleta / F1).
 * @param {vscode.ExtensionContext} context Contexto de extensión.
 * @returns {void}
 */
export function registerDiscoverCursorChatCommandsCommand(
  context: vscode.ExtensionContext,
): void {
  ensureSuggestionDebugChannel();
  const channel = vscode.window.createOutputChannel(GHOSTPROMPT_LOG_CHANNEL_NAME);
  const disposable = vscode.commands.registerCommand(
    'ghostPrompt.discoverCursorChatCommands',
    async () => {
      channel.clear();
      channel.show(true);
      await appendCursorChatCommandDiscovery(channel);
      void vscode.window.showInformationMessage(
        'GhostPrompt: lista de comandos Cursor en el canal «GhostPrompt Log».',
      );
    },
  );
  context.subscriptions.push(channel, disposable);
}
