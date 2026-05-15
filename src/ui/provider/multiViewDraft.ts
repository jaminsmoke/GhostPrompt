/**
 * @file Borrador compartido entre Sidebar y Panel (MiniInputViewProvider).
 */

let _draftText = '';

/**
 * Devuelve el texto del borrador compartido entre vistas.
 * @returns {string} Borrador actual del input GhostPrompt.
 */
export function getMultiViewDraftText(): string {
  return _draftText;
}

/**
 * Actualiza el borrador compartido entre vistas.
 * @param {string} text Nuevo texto del borrador.
 */
export function setMultiViewDraftText(text: string): void {
  _draftText = text;
}

/**
 * Reinicia el borrador (tests y tras enviar prompt al destino).
 */
export function resetMultiViewDraftText(): void {
  _draftText = '';
}
