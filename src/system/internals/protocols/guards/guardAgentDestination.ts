/**
 * @file Guard / normalizador del destino activo del agente.
 */

import { CURSOR_CHAT_DESTINATION_ID } from '../constants/consDestinations';

import type { AgentDestination } from '../types/typeDestinations';

/**
 * Normaliza un valor crudo de `agentDestination` al enum soportado.
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
