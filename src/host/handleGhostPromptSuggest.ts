/**
 * Punto de entrada estable para el mensaje webview `suggest`.
 * Implementación: {@link runGhostPromptSuggestPipeline} en `ghostPromptSuggestPipeline.ts`.
 */
export type { GhostPromptSuggestDeps } from "./ghostPromptSuggestPipeline";
export { runGhostPromptSuggestPipeline as handleGhostPromptSuggest } from "./ghostPromptSuggestPipeline";
