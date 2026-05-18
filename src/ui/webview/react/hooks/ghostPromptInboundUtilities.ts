/**
 * @file Utilidades compartidas para mensajes inbound del webview GhostPrompt.
 */
import type { InboundMessage } from '../types';

/**
 * Determina si un mensaje de borrador remoto proviene de otra vista GhostPrompt.
 * @param {InboundMessage} message - Mensaje entrante desde el host.
 * @param {string} viewId - Identificador de la vista actual.
 * @returns {message is Extract<InboundMessage, { type: 'draftSync' }>} True si es borrador sincronizado de otra vista.
 */
export function isDraftSyncForAnotherView(
  message: InboundMessage,
  viewId: string,
): message is Extract<InboundMessage, { type: 'draftSync' }> {
  return message.type === 'draftSync' && Boolean(viewId) && message.originViewId !== viewId;
}

/**
 * Comprueba si la sugerencia debe saltarse porque el mensaje es un borrador remoto.
 * @param {InboundMessage} message - Mensaje entrante desde el host.
 * @param {string} viewId - Identificador de la vista actual.
 * @returns {boolean} True si debe saltarse la sugerencia.
 */
export function shouldSkipSuggestionOnRemoteDraft(
  message: InboundMessage,
  viewId: string,
): boolean {
  return message.type === 'draftHydrate' || isDraftSyncForAnotherView(message, viewId);
}

/** Mensajes host→webview que pueden llevar `captureId` / `broadcast` para correlación. */
export type GhostPromptInboundCaptureCarrier = {
  broadcast?: boolean;
  captureId?: number;
};

/**
 * Actualiza el ref de correlación y decide si el mensaje entrante debe descartar la respuesta obsoleta.
 * @param {number} refBefore - Ref anterior de captura.
 * @param {GhostPromptInboundCaptureCarrier} message - Mensaje entrante con posible captureId/broadcast.
 * @returns {{ refAfter: number; drop: boolean }} Ref actualizado y bandera de descarte.
 */
export function ghostPromptApplyInboundCaptureReference(
  refBefore: number,
  message: GhostPromptInboundCaptureCarrier,
): { refAfter: number; drop: boolean } {
  let nextReference = refBefore;
  if (message.broadcast === true && typeof message.captureId === 'number') {
    nextReference = Math.max(nextReference, message.captureId);
  }
  if (typeof message.captureId === 'number') {
    if (message.captureId < nextReference) {
      return { refAfter: nextReference, drop: true };
    }
    if (message.captureId !== nextReference && message.broadcast !== true) {
      return { refAfter: nextReference, drop: true };
    }
  }
  return { refAfter: nextReference, drop: false };
}
