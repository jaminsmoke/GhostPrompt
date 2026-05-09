/**
 * @fileoverview Bridge to the official GitHub Copilot chat.
 *
 * Isolated in its own module to ease mocking in tests and to centralise
 * any future changes to the underlying VS Code command API.
 */
import * as vscode from "vscode";

/**
 * Sends a prompt to the official Copilot chat via the built-in command.
 * The chat panel handles the response, history, and model selection.
 *
 * @param query - The prompt text to send.
 */
export async function sendToChat(query: string): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.chat.open", { query });
}
