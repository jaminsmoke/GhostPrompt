/**
 * @file IDs de contribución de vista GhostPrompt (sidebar vs panel hub).
 */

/** Vista Activity Bar: superficie chat (prompt + sugerencias). */
export const GHOST_PROMPT_CHAT_VIEW_ID = 'ghostPrompt.input';

/** Vista panel inferior: superficie hub (ajustes, estadísticas futuras). */
export const GHOST_PROMPT_HUB_VIEW_ID = 'ghostPrompt.inputPanel';

export type GhostPromptWebviewSurface = 'chat' | 'hub';

/**
 * Resuelve la superficie webview según el ID inyectado por el host en `index.html`.
 * @returns {'chat' | 'hub'} `hub` solo para `ghostPrompt.inputPanel`; en entornos sin `window`, `chat`.
 */
export function resolveGhostPromptWebviewSurface(): GhostPromptWebviewSurface {
  const viewId = (globalThis as unknown as { window?: { __ghostPromptViewId?: string } }).window
    ?.__ghostPromptViewId;
  return viewId === GHOST_PROMPT_HUB_VIEW_ID ? 'hub' : 'chat';
}
