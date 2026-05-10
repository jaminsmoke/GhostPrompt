import * as vscode from "vscode";

import { getEnabledCompletionSources } from "../completion/completionSources";
import type { OpenCodeRuntime } from "./OpenCodeRuntime";

/**
 * Starts GhostPrompt's dedicated OpenCode server when OpenCode is among enabled completion sources;
 * schedules stop when it is not.
 */
export async function syncOpenCodeRuntimeFromConfig(
  runtime: OpenCodeRuntime,
): Promise<void> {
  const sources = getEnabledCompletionSources();

  if (!sources.includes("opencode")) {
    runtime.scheduleStop();
    return;
  }

  const result = await runtime.start();
  if (!result.ok) {
    void vscode.window.showWarningMessage(`GhostPrompt: ${result.error}`);
    return;
  }

  const healthy = await runtime.isHealthy();
  if (!healthy) {
    void vscode.window.showWarningMessage(
      "GhostPrompt: OpenCode server started but health check failed.",
    );
  }
}
