/**
 * @file Predicado: si un `type` outbound puede reenviarse a VSOpenCodeX.
 */
import { OUTBOUND_UI_FORWARD_KINDS } from '../constants/consOutboundForwardKinds';

/**
 * Indica si el valor de `type` del payload puede reenviarse por comando a VSOpenCodeX.
 * @param {string} messageType - Campo `type` del mensaje outbound.
 * @returns {boolean} Verdadero si el tipo está en el contrato de forward.
 */
export function isOutboundUiForwardKind(messageType: string): boolean {
  return new Set<string>(OUTBOUND_UI_FORWARD_KINDS).has(messageType);
}
