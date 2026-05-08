/**
 * @fileoverview Extension entry point.
 *
 * Registers the GhostPromptViewProvider in both the activity bar container
 * and the bottom panel container, so the user can place the view wherever
 * they prefer relative to the Copilot chat.
 */
import * as vscode from "vscode";
import { MiniInputViewProvider } from "./MiniInputViewProvider";
import { toggleSuggestionDebug } from "./SuggestionDebug";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new MiniInputViewProvider(context);
  const panelProvider = new MiniInputViewProvider(context);
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
  context.subscriptions.push(
    openSuggestionPolicySettingsCommand,
    toggleSuggestionDebugCommand,
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
  /* no-op */
}
