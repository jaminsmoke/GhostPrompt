import * as vscode from "vscode";

const DEBUG_SETTING_KEY = "debugSuggestions";
const OUTPUT_CHANNEL_NAME = "GhostPrompt Suggestions";

let outputChannel: vscode.OutputChannel | undefined;

function ensureDebugOutputChannel(): void {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
}

function appendDebugLine(line: string): void {
  ensureDebugOutputChannel();
  outputChannel?.appendLine(line);
}

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

  if (next) {
    const timestamp = new Date().toISOString();
    appendDebugLine(
      `[${timestamp}] [debug] GhostPrompt debug logging enabled. Open the 'GhostPrompt Suggestions' output channel to view logs.`,
    );
  }

  return next;
}

export function ensureSuggestionDebugChannel(): void {
  if (isSuggestionDebugEnabled()) {
    ensureDebugOutputChannel();
  }
}

export function logDebugInfo(message: string): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }
  const timestamp = new Date().toISOString();
  appendDebugLine(`[${timestamp}] [debug] ${message}`);
}

export function logSuggestionDebug(
  captureId: number,
  stage: string,
  details?: string,
): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const suffix = details ? ` | ${details}` : "";
  appendDebugLine(
    `[${timestamp}] [capture:${captureId}] [${stage}]${suffix}`,
  );
}

/**
 * Timings OpenCode / ciclo de vida (misma canalización que suggestions cuando debug está activo).
 * @param stage
 * @param details
 */
export function logOpenCodeDebug(stage: string, details?: string): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const suffix = details ? ` | ${details}` : "";
  appendDebugLine(`[${timestamp}] [opencode] [${stage}]${suffix}`);
}

/**
 * Fase I — duraciones por `suggest`; sólo cuando `ghostPrompt.debugSuggestions` está activo.
 * @param captureId
 * @param phase
 * @param details
 */
export function logOpenCodePerfCapture(
  captureId: number | undefined,
  phase: string,
  details?: string,
): void {
  if (!isSuggestionDebugEnabled()) {
    return;
  }
  const timestamp = new Date().toISOString();
  const capLabel = captureId === undefined ? "—" : String(captureId);
  const suffix = details ? ` | ${details}` : "";
  appendDebugLine(
    `[${timestamp}] [capture:${capLabel}] [opencode-perf] [${phase}]${suffix}`,
  );
}
