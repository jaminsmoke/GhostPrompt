/**
 * @file Registros de estado de error al comprobar un proveedor LM.
 */
import type { ProviderStateRecord, ProviderStatusModule } from '../internals/protocols/state/provider';

/**
 * Construye un registro de estado de error cuando `check()` de un módulo falla.
 * @param {Pick<ProviderStatusModule, 'id' | 'label'>} mod Módulo cuyo estado no pudo comprobarse.
 * @returns {ProviderStateRecord} Registro con `status: 'error'` y texto localizado.
 */
export function createProviderErrorRecord(
  mod: Pick<ProviderStatusModule, 'id' | 'label'>,
): ProviderStateRecord {
  return {
    id: mod.id,
    status: 'error',
    label: mod.label,
    statusText: 'Error al comprobar estado',
  };
}
