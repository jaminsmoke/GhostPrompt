/**
 * @file Extension entry point.
 *
 * Registers the GhostPromptViewProvider in both the activity bar container
 * and the bottom panel container, so the user can place the view wherever
 * they prefer relative to the Copilot chat.
 */
import * as vscode from 'vscode';

import '../destinations/copilotChat/copilotChatDestination';
import '../destinations/cursor/cursorChatDestination';
import { registerDiscoverCursorChatCommandsCommand } from '../destinations/cursor/discoverCursorChatCommands';
import { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } from '../destinations/vsOpenCodeX/vsOpenCodeXDestination';
import { ollamaModelManager } from '../engines/provider/ollama';
import { resetClient } from '../engines/provider/opencode/client';
import { registerProviderStatusRegistry } from '../engines/runtime/providerStatusRegistry';
import {
  disposeGhostPromptLogging,
  ensureSuggestionDebugChannel,
  initGhostPromptLogging,
  isSuggestionDebugEnabled,
  toggleSuggestionDebug,
} from '../system/log';
import { MiniInputViewProvider } from '../ui/provider/MiniInputViewProvider';

/**
 * Activa la extensión GhostPrompt.
 * @param {vscode.ExtensionContext} context - Contexto de la extensión proporcionado por VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
  initGhostPromptLogging(context);
  registerProviderStatusRegistry();
  const sidebarProvider = new MiniInputViewProvider(context, MiniInputViewProvider.viewId);
  const panelProvider = new MiniInputViewProvider(context, MiniInputViewProvider.panelViewId);
  const openSuggestionPolicySettingsCommand = vscode.commands.registerCommand(
    'ghostPrompt.openSuggestionPolicySettings',
    async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'ghostPrompt.suggestionModelPolicy',
      );
    },
  );
  const toggleSuggestionDebugCommand = vscode.commands.registerCommand(
    'ghostPrompt.toggleSuggestionDebug',
    async () => {
      const enabled = await toggleSuggestionDebug();
      const message = enabled
        ? 'GhostPrompt debug activado (canal de salida «GhostPrompt Log»).'
        : 'GhostPrompt debug desactivado.';
      await vscode.window.showInformationMessage(message);
    },
  );
  const runSuggestPipelineCommand = vscode.commands.registerCommand(
    'ghostPrompt.runSuggestPipeline',
    async (args: { text?: string } | undefined) => {
      const text = typeof args?.text === 'string' ? args.text : '';
      await MiniInputViewProvider.runSuggestFromExternalHost(text);
    },
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ghostPrompt')) {
        MiniInputViewProvider.refreshSettingsAllViews().catch(() => {
          /* ignore */
        });
      }
      if (e.affectsConfiguration('ghostPrompt.agentDestination')) {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      }
    }),
  );
  notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
  registerDiscoverCursorChatCommandsCommand(context);

  if (isSuggestionDebugEnabled()) {
    ensureSuggestionDebugChannel();
  }

  context.subscriptions.push(
    openSuggestionPolicySettingsCommand,
    toggleSuggestionDebugCommand,
    runSuggestPipelineCommand,
    vscode.window.registerWebviewViewProvider(MiniInputViewProvider.viewId, sidebarProvider),
    vscode.window.registerWebviewViewProvider(MiniInputViewProvider.panelViewId, panelProvider),
  );
}

/**
 * Limpia los recursos de la extensión al desactivarse.
 */
export function deactivate(): void {
  disposeGhostPromptLogging().catch(() => {
    /* ignore */
  });
  resetClient();
  ollamaModelManager.stopAll().catch(() => {
    /* ignore */
  });
}
