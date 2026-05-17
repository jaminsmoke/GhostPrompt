/**
 * @file Anillo de migajas por `captureId` (FIFO, tamaño acotado).
 */
import type { Breadcrumb } from './types';

const DEFAULT_MAX_PER_CAPTURE = 20;

/**
 * Almacena migajas por identificador de captura para adjuntarlas en WARN/ERROR.
 * Evicción FIFO cuando se supera el límite por `captureId`.
 */
export class CaptureBreadcrumbStore {
  private readonly byCaptureId = new Map<number, Breadcrumb[]>();

  /**
   * Crea el almacén con un tope de migajas por identificador de captura.
   * @param {number} [maxPerCapture] - Tamaño máximo del anillo por `captureId`.
   */
  constructor(private readonly maxPerCapture: number = DEFAULT_MAX_PER_CAPTURE) {}

  /**
   * Copia superficial de las migajas actuales (sin mutar el buffer interno).
   * @param {number} captureId - Identificador de correlación.
   * @returns {Breadcrumb[]} Lista clonada (puede estar vacía).
   */
  snapshot(captureId: number): Breadcrumb[] {
    const current = this.byCaptureId.get(captureId);
    return current ? [...current] : [];
  }

  /**
   * Añade una migaja al anillo del `captureId` (evicción FIFO).
   * @param {number} captureId - Identificador de correlación.
   * @param {Breadcrumb} crumb - Migaja a registrar.
   * @returns {void} Void.
   */
  push(captureId: number, crumb: Breadcrumb): void {
    const arr = this.byCaptureId.get(captureId) ?? [];
    arr.push(crumb);
    if (arr.length > this.maxPerCapture) {
      arr.splice(0, arr.length - this.maxPerCapture);
    }
    this.byCaptureId.set(captureId, arr);
  }

  /**
   * Borra el anillo asociado a un `captureId`, por ejemplo al terminar el pipeline.
   * @param {number} captureId - Identificador de correlación.
   * @returns {void} Sin valor de retorno.
   */
  flushCapture(captureId: number): void {
    this.byCaptureId.delete(captureId);
  }
}
