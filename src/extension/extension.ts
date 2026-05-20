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
import { migrateGhostPromptSuggestionLengthSettings } from '../system/internals/config/read/migrateGhostPromptSuggestionLength';
import { isDefined } from '../system/internals/isDefined';
import {
  disposeGhostPromptLogging,
  ensureSuggestionDebugChannel,
  formatHostFaultMessage,
  getLogger,
  initGhostPromptLogging,
  isSuggestionDebugEnabled,
  reportHostFault,
  toggleSuggestionDebug,
} from '../system/log';
import { appendGhostPromptOutputLine } from '../system/log/transports/outputChannel';
import { MiniInputViewProvider } from '../ui/provider/MiniInputViewProvider';

interface ExtensionPackageManifest {
  version?: string;
}

/**
 * Activa la extensión GhostPrompt.
 * @param {vscode.ExtensionContext} context - Contexto de la extensión proporcionado por VS Code.
 * @throws {Error} Si el registro de vistas o comandos falla de forma irrecuperable.
 */
export function activate(context: vscode.ExtensionContext): void {
  const extensionPackage = context.extension.packageJSON as ExtensionPackageManifest;
  const version =
    typeof extensionPackage.version === 'string' ? extensionPackage.version : 'unknown';
  appendGhostPromptOutputLine(`[GhostPrompt] Activating extension v${version}…`);
  initGhostPromptLogging(context);
  const log = getLogger('extension');

  try {
    log.info('activate-start', { version });
    migrateGhostPromptSuggestionLengthSettings(context).catch((error: unknown) => {
      log.error('migrate-suggestion-length-failed', {}, error);
    });
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
    const openHubCommand = vscode.commands.registerCommand('ghostPrompt.openHub', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.ghostPromptPanel');
      await vscode.commands.executeCommand(`${MiniInputViewProvider.panelViewId}.focus`);
    });
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('ghostPrompt')) {
          MiniInputViewProvider.refreshSettingsAllViews().catch((error: unknown) => {
            log.error('refresh-settings-failed', {}, error);
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
      openHubCommand,
      vscode.window.registerWebviewViewProvider(MiniInputViewProvider.viewId, sidebarProvider),
      vscode.window.registerWebviewViewProvider(MiniInputViewProvider.panelViewId, panelProvider),
    );
    log.info('activate-complete', {
      views: [MiniInputViewProvider.viewId, MiniInputViewProvider.panelViewId],
    });
  } catch (error: unknown) {
    reportHostFault('extension', 'activate-failed', error);
    log.error('activate-failed', {}, error);
    const errorNotification = vscode.window.showErrorMessage(formatHostFaultMessage(error));
    if (isDefined(errorNotification)) {
      Promise.resolve(errorNotification).catch(() => {
        /* El fallo ya quedó en GhostPrompt Log vía reportHostFault. */
      });
    }
    throw error;
  }
}

/**
 * Limpia los recursos de la extensión al desactivarse.
 */
export function deactivate(): void {
  disposeGhostPromptLogging().catch((error: unknown) => {
    reportHostFault('extension', 'dispose-logging-failed', error, { reveal: false });
  });
  resetClient();
  ollamaModelManager.stopAll().catch((error: unknown) => {
    getLogger('extension').error('ollama-stop-all-failed', {}, error);
  });
}
