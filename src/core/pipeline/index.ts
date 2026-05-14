/**
 * Punto de entrada estable para el mensaje webview `suggest`.
 * Implementación en `suggestPipeline.ts`.
 */

export type { GhostPromptSuggestDeps } from './suggestPipeline';
export { runGhostPromptSuggestPipeline } from './suggestPipeline';
export { runGhostPromptSuggestPipeline as handleGhostPromptSuggest } from './suggestPipeline';
