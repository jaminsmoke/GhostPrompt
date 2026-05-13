/**
 * Aviso si el usuario eligió destino VSOpenCodeX pero la extensión no está disponible (Fase D / roadmap v0.5).
 */
import * as vscode from "vscode";
import { VS_OPEN_CODE_X_EXTENSION_ID } from "../engines/opencode/vsOpenCodeXConnection";
import { getGhostPromptAgentDestination } from "./ghostPromptHostWorkspaceGetters";

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
