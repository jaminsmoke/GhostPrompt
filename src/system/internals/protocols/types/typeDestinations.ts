/**
 * @file Tipos puros del dominio de destinos del agente.
 */

import {
  CURSOR_CHAT_DESTINATION_ID,
  type AGENT_DESTINATION_IDS,
} from '../constants/consDestinations';

export type DestinationId = (typeof AGENT_DESTINATION_IDS)[number];

export type AgentDestination = DestinationId;

export interface DestinationProvider {
  readonly id: DestinationId;
  sendPrompt?: (text: string) => Promise<void>;
  forwardSuggestionUi?: (payload: Record<string, unknown>) => void;
}

/**
 * Normaliza un valor crudo de `ghostPrompt.agentDestination` al enum soportado.
 * Valores desconocidos → `copilotChat`.
 * @param {string | undefined} raw - Valor leído de configuración o webview.
 * @returns {AgentDestination} Destino normalizado.
 */
export function parseAgentDestination(raw: string | undefined): AgentDestination {
  if (raw === 'vsOpenCodeX') {
    return 'vsOpenCodeX';
  }
  if (raw === CURSOR_CHAT_DESTINATION_ID) {
    return CURSOR_CHAT_DESTINATION_ID;
  }
  return 'copilotChat';
}
