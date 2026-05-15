/**
 * @file Registros de estado de error al comprobar una fuente de completado.
 */
import type {
  CompletionSourceStateRecord,
  CompletionSourceStatusModule,
} from './completionSourceStatusTypes';

/**
 * Construye un registro de estado de error cuando `check()` de un módulo falla.
 * @param {Pick<CompletionSourceStatusModule, 'id' | 'label'>} mod Módulo cuyo estado no pudo comprobarse.
 * @returns {CompletionSourceStateRecord} Registro con `status: 'error'` y texto localizado.
 */
export function createCompletionSourceErrorRecord(
  mod: Pick<CompletionSourceStatusModule, 'id' | 'label'>,
): CompletionSourceStateRecord {
  return {
    id: mod.id,
    status: 'error',
    label: mod.label,
    statusText: 'Error al comprobar estado',
  };
}
