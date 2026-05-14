/**
 * @file Extension entry point.
 *
 * Registers the GhostPromptViewProvider in both the activity bar container
 * and the bottom panel container, so the user can place the view wherever
 * they prefer relative to the Copilot chat.
 */
import * as vscode from "vscode";
import { MiniInputViewProvider } from "../ui/provider/MiniInputViewProvider";
import {
  isSuggestionDebugEnabled,
  ensureSuggestionDebugChannel,
  toggleSuggestionDebug,
} from '../system/debug/SuggestionDebug';
import { resetClient } from "../engines/opencode/opencodeApiClient";
import { ollamaModelManager } from "../engines/ollama";
import { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } from "../destinations/vsOpenCodeX/vsOpenCodeXDestination";
import "../destinations/copilotChat/copilotChatDestination";
import { registerProjectMemory } from "../core/memory/activate";
import { registerAllProviderModules } from "../system/status/registerModules";

/**
 * Activa la extensión GhostPrompt.
 * @param context Contexto de la extensión proporcionado por VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
  registerAllProviderModules();
  registerProjectMemory(context);
  const sidebarProvider = new MiniInputViewProvider(
    context,
    MiniInputViewProvider.viewId,
  );
  const panelProvider = new MiniInputViewProvider(
    context,
    MiniInputViewProvider.panelViewId,
  );
  const openSuggestionPolicySettingsCommand = vscode.commands.registerCommand(
    "ghostPrompt.openSuggestionPolicySettings",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "ghostPrompt.suggestionModelPolicy",
      );
    },
  );
  const toggleSuggestionDebugCommand = vscode.commands.registerCommand(
    "ghostPrompt.toggleSuggestionDebug",
    async () => {
      const enabled = await toggleSuggestionDebug();
      const message = enabled
        ? "GhostPrompt debug activado (Suggestions output channel)."
        : "GhostPrompt debug desactivado.";
      void vscode.window.showInformationMessage(message);
    },
  );
  const runSuggestPipelineCommand = vscode.commands.registerCommand(
    "ghostPrompt.runSuggestPipeline",
    async (args: { text?: string } | undefined) => {
      const text = typeof args?.text === "string" ? args.text : "";
      await MiniInputViewProvider.runSuggestFromExternalHost(text);
    },
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("ghostPrompt")) {
        void MiniInputViewProvider.refreshSettingsAllViews();
      }
      if (e.affectsConfiguration("ghostPrompt.agentDestination")) {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      }
    }),
  );
  notifyIfVsxAgentDestinationWithoutVsOpenCodeX();

  if (isSuggestionDebugEnabled()) {
    ensureSuggestionDebugChannel();
  }

  context.subscriptions.push(
    openSuggestionPolicySettingsCommand,
    toggleSuggestionDebugCommand,
    runSuggestPipelineCommand,
    vscode.window.registerWebviewViewProvider(
      MiniInputViewProvider.viewId,
      sidebarProvider,
    ),
    vscode.window.registerWebviewViewProvider(
      MiniInputViewProvider.panelViewId,
      panelProvider,
    ),
  );
}

/**
 * Limpia los recursos de la extensión al desactivarse.
 */
export function deactivate(): void {
  resetClient();
  ollamaModelManager.stopAll();
}