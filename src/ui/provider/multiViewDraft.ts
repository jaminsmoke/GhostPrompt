/**
 * @file Borrador compartido entre Sidebar y Panel (MiniInputViewProvider).
 */

let sharedDraftText = '';

/**
 * Devuelve el texto del borrador compartido entre vistas.
 * @returns {string} Borrador actual del input GhostPrompt.
 */
export function getMultiViewDraftText(): string {
  return sharedDraftText;
}

/**
 * Actualiza el borrador compartido entre vistas.
 * @param {string} text - Nuevo texto del borrador.
 */
export function setMultiViewDraftText(text: string): void {
  sharedDraftText = text;
}

/**
 * Reinicia el borrador (tests y tras enviar prompt al destino).
 */
export function resetMultiViewDraftText(): void {
  sharedDraftText = '';
}
