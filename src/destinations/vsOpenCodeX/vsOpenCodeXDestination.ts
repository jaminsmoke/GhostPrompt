/**
 * @file Implementación del destino VSOpenCodeX para reenviar UI de GhostPrompt al editor VSOpenCodeX.
 */

import * as vscode from 'vscode';

import {
  
  VS_OPEN_CODE_X_INLINE_UI_COMMAND,
  
} from '../../system/internals/protocols/constants';
import { isOutboundUiForwardKind } from '../../system/internals/protocols/guards/guardOutboundForward';
import { getLogger } from '../../system/log';
import {
  type DestinationProvider,
  getAgentDestination,
  registerDestination,
  VS_OPEN_CODE_X_EXTENSION_ID,
} from '../destinationRegistry';

/**
 * Reenvía mensajes de UI de GhostPrompt a VSOpenCodeX cuando el destino está activo.
 * @param {Record<string, unknown>} payloadWithBroadcast - Payload con posibles datos de broadcast.
 * @returns {void}
 */
export function forwardGhostPromptInlineUiToVsOpenCodeIfApplicable(
  payloadWithBroadcast: Record<string, unknown>,
): void {
  if (getAgentDestination() !== 'vsOpenCodeX') {
    return;
  }
  const t = payloadWithBroadcast.type;
  if (typeof t !== 'string' || !isOutboundUiForwardKind(t)) {
    return;
  }

  const { broadcast: _b, ...sanitized } = payloadWithBroadcast;
  Promise.resolve(
    vscode.commands.executeCommand(VS_OPEN_CODE_X_INLINE_UI_COMMAND, sanitized),
  ).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    getLogger('vsOpenCodeX').error('vsopencodex-inline-forward-failed', { detail: msg }, error);
  });
}

let notifiedMissingVsxThisSession = false;

/**
 * Notifica al usuario cuando el destino VSOpenCodeX está activo pero la extensión no está instalada.
 * @returns {void}
 */
export function notifyIfVsxAgentDestinationWithoutVsOpenCodeX(): void {
  if (getAgentDestination() !== 'vsOpenCodeX') {
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
  Promise.resolve(
    vscode.window.showInformationMessage(
      'GhostPrompt: el destino del agente es VSOpenCodeX, pero esa extensión no está instalada o no está cargada. Instálala o cambia ghostPrompt.agentDestination a copilotChat.',
      'Abrir ajustes',
    ),
  )
    .then((choice) => {
      if (choice === 'Abrir ajustes') {
        Promise.resolve(
          vscode.commands.executeCommand('workbench.action.openSettings', 'ghostPrompt.agentDestination'),
        ).catch(() => {
          /* Ignore */
        });
      }
    })
    .catch(() => {
      /* Ignore */
    });
}

const vsOpenCodeXProvider: DestinationProvider = {
  id: 'vsOpenCodeX',
  forwardSuggestionUi: forwardGhostPromptInlineUiToVsOpenCodeIfApplicable,
};

registerDestination(vsOpenCodeXProvider);

export {OUTBOUND_UI_FORWARD_KINDS, type OutboundUiForwardKind, VS_OPEN_CODE_X_INLINE_UI_COMMAND} from '../../system/internals/protocols/constants';
export {isOutboundUiForwardKind} from '../../system/internals/protocols/guards/guardOutboundForward';