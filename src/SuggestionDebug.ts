import * as vscode from "vscode";

const DEBUG_SETTING_KEY = "debugSuggestions";
const OUTPUT_CHANNEL_NAME = "GhostPrompt Suggestions";

let outputChannel: vscode.OutputChannel | undefined;

export function isSuggestionDebugEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<boolean>(DEBUG_SETTING_KEY, false);
}

export async function toggleSuggestionDebug(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("ghostPrompt");
  const current = config.get<boolean>(DEBUG_SETTING_KEY, false);
  const next = !current;
  await config.update(DEBUG_SETTING_KEY, next, vscode.ConfigurationTarget.Global);
  return next;
}

export function logSuggestionDebug(
  captureId: number,
  stage: string,
  details?: string,
): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }

  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }

  const timestamp = new Date().toISOString();
  const suffix = details ? ` | ${details}` : "";
  outputChannel.appendLine(
    `[${timestamp}] [capture:${captureId}] [${stage}]${suffix}`,
  );
}
