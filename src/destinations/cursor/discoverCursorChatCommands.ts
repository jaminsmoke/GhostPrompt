/**
 * @file Herramienta de desarrollo para descubrir comandos de Cursor Chat/Composer.
 *
 * **Propósito:** Utilidad de debugging que escanea y registra comandos candidatos
 * en la extensión Cursor. No forma parte del flujo de producción de GhostPrompt.
 *
 * **Nota:** Este comando y su registro en `extension.ts` son provisionales.
 * En un futuro roadmap se revisará el destino Cursor Chat completo, incluyendo
 * la posible eliminación o refactorización de esta herramienta.
 */
import * as vscode from 'vscode';
import { appendCursorChatCommandDiscovery } from './cursorChatCommands';
import { ensureSuggestionDebugChannel } from '../../system/log';

/**
 * Registra `ghostPrompt.discoverCursorChatCommands` (paleta / F1).
 * @param {vscode.ExtensionContext} context Contexto de extensión.
 * @returns {void}
 */
export function registerDiscoverCursorChatCommandsCommand(context: vscode.ExtensionContext): void {
  const channel = ensureSuggestionDebugChannel();
  if (!channel) {
    throw new Error('GhostPrompt logging not initialized when registering Cursor discovery command.');
  }
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
