/**
 * @file Punto de entrada público del dominio "core" (barrel).
 *
 * Contiene la lógica central de suggestions, incluyendo tipos, prompt, presentation, streaming,
 * lenguaje, estado compartido host, context bootstrap, resolución de fuentes y sugerencias.
 * El `SuggestionRequestGovernor` se mantiene como legacy en `system/policies/` y no se reexporta desde aquí.
 *
 * Motores y catálogos (`listSuggestionModels`, registry, `requestCopilotLmCompletion`, …)
 * viven en `engines/` y no se reexportan aquí para evitar que `core` sea pasarela hacia Copilot/OpenCode/Ollama.
 *
 * Rutado de fuentes: `getEnabledCompletionSources`, `resolveCompletionSourceForRequest`.
 * Invocación al LM: `getCompletionProviderForSource` en `engines/engineRegistry.ts`.
 */
export * from './types';
export { suggestionLoadingStatusText, type SuggestionLoadingPhase } from './presentation';
export {
  buildProjectBootstrapCardLines,
  collectProjectBootstrapPieces,
  fingerprintProjectBootstrapLines,
  PROJECT_PACKAGE_JSON_MAX_SCRIPT_NAMES,
  PROJECT_PACKAGE_JSON_SUMMARY_MAX_CHARS,
  PROJECT_README_CARD_MAX_CHARS,
  resolveGhostPromptWorkspaceFolderUri,
  sha256HexBytes,
  sortProjectBootstrapPieces,
  summarizePackageJsonForProjectCard,
  truncateProjectCardText,
  type ProjectBootstrapPiece,
} from './memory/projectBootstrapContext';
export * from './prompt';
export * from './language';
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
