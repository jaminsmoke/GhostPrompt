/**
 * @file Utilidades compartidas para mensajes inbound del webview GhostPrompt.
 */

/** Mensajes host→webview que pueden llevar `captureId` / `broadcast` para correlación. */
export type GhostPromptInboundCaptureCarrier = {
  broadcast?: boolean;
  captureId?: number;
};

/**
 * Invalida la generación actual del borrador (cada edición local del usuario).
 * Las respuestas inbound con `captureId` menor deben descartarse hasta el próximo `suggest`.
 * @param {number} captureReference - Valor actual del ref de generación del borrador.
 * @returns {number} Nuevo `captureId` de generación del borrador.
 */
export function bumpDraftCaptureGeneration(captureReference: number): number {
  return captureReference + 1;
}

/** Acciones mínimas para aplicar un borrador remoto (hydrate desde el host). */
export type RemoteDraftRelayActions = {
  getCaptureId: () => number;
  setCaptureId: (value: number) => void;
  setSuggestion: (value: string) => void;
  setIsLoading: (value: boolean) => void;
  armSkipSuggestionOnDraftRelay: () => void;
  setText: (value: string) => void;
};

/**
 * Sincroniza el texto remoto con el compositor del webview.
 * Invalida la sugerencia pendiente, el estado de carga y las capturas en curso.
 * @param {string} text - Texto del borrador enviado por el host al abrir o hidratar la vista chat.
 * @param {RemoteDraftRelayActions} actions - Callbacks de estado del webview.
 * @returns {void}
 */
export function applyRemoteDraftRelay(text: string, actions: RemoteDraftRelayActions): void {
  actions.setCaptureId(bumpDraftCaptureGeneration(actions.getCaptureId()));
  actions.setSuggestion('');
  actions.setIsLoading(false);
  actions.armSkipSuggestionOnDraftRelay();
  actions.setText(text);
}

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
