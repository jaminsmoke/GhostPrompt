/**
 * @file Punto de entrada público del dominio "core" (barrel).
 *
 * Contiene la lógica central de suggestions, incluyendo tipos, prompt, presentation, streaming,
 * estado compartido host, resolución de fuentes y sugerencias.
 *
 * Motores y catálogos (`listSuggestionModels`, registry, `requestCopilotLmCompletion`, …)
 * viven en `engines/` y no se reexportan aquí para evitar que `core` sea pasarela hacia Copilot/OpenCode/Ollama.
 *
 * Rutado de fuentes: `getEnabledCompletionSources`, `resolveCompletionSourceForRequest`.
 * Invocación al LM: `getCompletionProviderForSource` en `engines/engineRegistry.ts`.
 */
export * from './types';
export { suggestionLoadingStatusText, type SuggestionLoadingPhase } from './presentation';
export * from './prompt';
export * from './streaming';
export {
  getCompletionUiKind,
  getEnabledCompletionSources,
  looksLikeOpencodeModelId,
  looksLikeOllamaModelId,
  resolveCompletionSourceForRequest,
  type CompletionSourceId,
} from './routing/sources';
export { GhostPromptSessionStore } from './state/GhostPromptSessionStore';
export type { GhostPromptSuggestDeps } from './suggest';
export { runGhostPromptSuggestPipeline, handleGhostPromptSuggest } from './suggest';
export { ProviderStatusManager, providerStatusManager } from './status';
export type {
  ProviderKind,
  ProviderState,
  ProviderStateRecord,
  ProviderStatusModule,
} from './status';
export { registerAllProviderModules } from './status/registerModules';
