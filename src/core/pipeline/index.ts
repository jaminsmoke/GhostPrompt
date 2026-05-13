/**
 * Punto de entrada estable para el mensaje webview `suggest`.
 * Implementación: {@link runGhostPromptSuggestPipeline} en `suggestPipeline.ts`.
 */

export type { GhostPromptSuggestDeps } from "./suggestPipeline";
export { runGhostPromptSuggestPipeline } from "./suggestPipeline";
export { runGhostPromptSuggestPipeline as handleGhostPromptSuggest } from "./suggestPipeline";
