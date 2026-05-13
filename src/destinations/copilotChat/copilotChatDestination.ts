import * as vscode from "vscode";
import type { DestinationProvider } from "../destinationRegistry";
import { registerDestination } from "../destinationRegistry";

async function sendToChat(query: string): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.chat.open", { query });
}

const copilotChatProvider: DestinationProvider = {
  id: "copilotChat",
  sendPrompt: sendToChat,
};

registerDestination(copilotChatProvider);

export { sendToChat };
