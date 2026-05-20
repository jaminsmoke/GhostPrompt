/**
 * @file Predicado sobre IDs de proveedor LM en configuración y mensajes.
 */
import { PROVIDER_ID_VALUES, type ProviderId } from '../state/provider/stateProviderId';

/**
 * Comprueba si un valor coincide con un ID de fuente de completado válido.
 * @param {unknown} value - Valor a validar.
 * @returns {value is ProviderId} True si el valor es un proveedor válido.
 */
export function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === 'string' &&
    (PROVIDER_ID_VALUES as readonly string[]).includes(value)
  );
}
