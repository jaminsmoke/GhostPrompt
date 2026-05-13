import * as vscode from "vscode";
import { logSuggestionDebug } from "../../debug/SuggestionDebug";
import {
  type DestinationProvider,
  getGhostPromptAgentDestination,
  registerDestination,
  VS_OPEN_CODE_X_EXTENSION_ID,
} from "../destinationRegistry";

/** Comando en VSOpenCodeX: mismo payload que postMessage GP sin campo `broadcast`. */
export const VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI =
  "vsopencodex.ghostPromptInlineUi";

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
    vscode.commands.executeCommand(
      VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI,
      sanitized,
    ),
  ).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    logSuggestionDebug(0, "vsopencodex-inline-forward-failed", msg);
  });
}

let notifiedMissingVsxThisSession = false;

export function notifyIfVsxAgentDestinationWithoutVsOpenCodeX(): void {
  if (getGhostPromptAgentDestination() !== "vsOpenCodeX") {
    notifiedMissingVsxThisSession = false;
    return;
  }
  if (vscode.extensions.getExtension(VS_OPEN_CODE_X_EXTENSION_ID)) {
    return;
  }
  if (notifiedMissingVsxThisSession) {
    return;
  }
  notifiedMissingVsxThisSession = true;
  void vscode.window
    .showInformationMessage(
      "GhostPrompt: el destino del agente es VSOpenCodeX, pero esa extensión no está instalada o no está cargada. Instálala o cambia ghostPrompt.agentDestination a copilotChat.",
      "Abrir ajustes",
    )
    .then((choice) => {
      if (choice === "Abrir ajustes") {
        void vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "ghostPrompt.agentDestination",
        );
      }
    });
}

const vsOpenCodeXProvider: DestinationProvider = {
  id: "vsOpenCodeX",
  forwardSuggestionUi: forwardGhostPromptInlineUiToVsOpenCodeIfApplicable,
};

registerDestination(vsOpenCodeXProvider);
