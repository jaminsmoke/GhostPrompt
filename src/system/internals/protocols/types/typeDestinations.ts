/**
 * @file Tipos puros del dominio de destinos del agente.
 */

import type { AGENT_DESTINATION_IDS } from '../constants/consDestinations';

export type DestinationId = (typeof AGENT_DESTINATION_IDS)[number];

export type AgentDestination = DestinationId;

export interface DestinationProvider {
  readonly id: DestinationId;
  sendPrompt?: (text: string) => Promise<void>;
  forwardSuggestionUi?: (payload: Record<string, unknown>) => void;
}
