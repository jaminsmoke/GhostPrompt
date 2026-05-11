/**
 * Replica el UI de suggestion de GhostPrompt hacia VSOpenCodeX cuando el destino agente es VSX.
 * El comando DEBE estar implementado en VSOpenCodeX; hasta entonces executeCommand puede fallar de forma benigna.
 * @see Docs/Integrations/GhostPrompt-motor-destino-matrix.md
 */
import * as vscode from "vscode";

import { logSuggestionDebug } from "../debug/SuggestionDebug";
import { getGhostPromptAgentDestination } from "./ghostPromptHostWorkspaceGetters";

/** Comando en VSOpenCodeX: mismo payload que postMessage GP sin campo `broadcast`. */
export const VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI = "vsopencodex.ghostPromptInlineUi";

const FORWARD_MESSAGE_TYPES = new Set<string>([
  "loading",
  "suggestion-stream",
  "suggestion",
  "empty",
  "error",
  "clear",
  "languageEffective",
]);

export function forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(
  payloadWithBroadcast: Record<string, unknown>,
): void {
  if (getGhostPromptAgentDestination() !== "vsOpenCodeX") {
    return;
  }
  const t = payloadWithBroadcast.type;
  if (typeof t !== "string" || !FORWARD_MESSAGE_TYPES.has(t)) {
    return;
  }

  const { broadcast: _b, ...sanitized } = payloadWithBroadcast;
  void Promise.resolve(
    vscode.commands.executeCommand(VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI, sanitized),
  ).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    logSuggestionDebug(0, "vsopencodex-inline-forward-failed", msg);
  });
}
