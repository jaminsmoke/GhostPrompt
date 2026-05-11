/**
 * @fileoverview Extension entry point.
 *
 * Registers the GhostPromptViewProvider in both the activity bar container
 * and the bottom panel container, so the user can place the view wherever
 * they prefer relative to the Copilot chat.
 */
import * as vscode from "vscode";
import { MiniInputViewProvider } from "../host/MiniInputViewProvider";
import { toggleSuggestionDebug } from "../debug/SuggestionDebug";
import {
  getOpenCodeRuntime,
  invalidateOpenCodeProvidersSnapshot,
  invalidateOpencodeInlineSuggestionSessionPool,
  resetOpencodeInlineLmQueue,
  syncOpenCodeRuntimeFromConfig,
} from "../opencode";
import { registerProjectMemory } from "../projectMemory/activateProjectMemory";
import { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } from "../host/notifyVsxAgentDestinationIfExtensionMissing";

export function activate(context: vscode.ExtensionContext): void {
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
  const openCodeRuntime = getOpenCodeRuntime();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("ghostPrompt.completionProvider") ||
        e.affectsConfiguration("ghostPrompt.enabledCompletionSources") ||
        e.affectsConfiguration("ghostPrompt.preferVsOpenCodeXOpenCode") ||
        e.affectsConfiguration("ghostPrompt.vsOpenCodeXProbeDelayMs") ||
        e.affectsConfiguration("ghostPrompt.vsOpenCodeXConnectionMaxAttempts") ||
        e.affectsConfiguration("ghostPrompt.vsOpenCodeXConnectionRetryGapMs")
      ) {
        openCodeRuntime.stop();
        void syncOpenCodeRuntimeFromConfig(openCodeRuntime);
      }
      if (e.affectsConfiguration("ghostPrompt")) {
        void MiniInputViewProvider.refreshSettingsAllViews();
      }
      if (e.affectsConfiguration("ghostPrompt.agentDestination")) {
        notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
      }
    }),
  );
  void syncOpenCodeRuntimeFromConfig(openCodeRuntime);
  notifyIfVsxAgentDestinationWithoutVsOpenCodeX();

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

export function deactivate(): void {
  invalidateOpenCodeProvidersSnapshot();
  invalidateOpencodeInlineSuggestionSessionPool();
  resetOpencodeInlineLmQueue();
  getOpenCodeRuntime().stop();
}
