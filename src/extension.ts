/**
 * @fileoverview Extension entry point.
 *
 * Registers the GhostPromptViewProvider in both the activity bar container
 * and the bottom panel container, so the user can place the view wherever
 * they prefer relative to the Copilot chat.
 */
import * as vscode from "vscode";
import { MiniInputViewProvider } from "./MiniInputViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new MiniInputViewProvider(context);
  const panelProvider = new MiniInputViewProvider(context);

  context.subscriptions.push(
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
