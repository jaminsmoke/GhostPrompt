/**
 * @fileoverview Punto de entrada público del dominio "core" (barrel).
 *
 * Lógica pura de suggestions: tipos, instrucción, normalización, streaming,
 * governor, session, catálogo merged, context bootstrap, y resolución de fuentes.
 *
 * El **host** enruta por modelo y fuentes: `getCompletionProviderForSource` +
 * `resolveCompletionSourceForRequest` (`sources.ts`). Con una sola fuente,
 * `getActiveCompletionProvider()` sigue siendo válido; con varias fuentes y `auto`,
 * el UI puede seguir mostrando Copilot como "primario" para el kind legacy.
 *
 * **Alias:** `requestCompletion` reexporta solo `requestCopilotLmCompletion` por
 * compatibilidad histórica; el flujo webview usa los proveedores registrados en engines.
 */
export * from "./types";
export {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from "./loading";
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
} from "./context/projectBootstrapContext";
export * from "./instruction";
export * from "./normalize";
export * from "./language";
export * from "./streaming";
export * from "../engines/copilot/catalog/modelCatalog";

export { requestCopilotLmCompletion as requestCompletion } from "../engines/copilot/copilotLmEngine";

export type { CompletionProvider } from "../engines/engineRegistry";
export {
  getActiveCompletionProvider,
  getCompletionProviderForSource,
  getCompletionProviderKind,
} from "../engines/engineRegistry";
export {
  getCompletionUiKind,
  getEnabledCompletionSources,
  looksLikeOpencodeModelId,
  looksLikeOllamaModelId,
  resolveCompletionSourceForRequest,
  type CompletionSourceId,
} from "./sources";
export { listMergedSuggestionModels } from "./catalog/mergedModelCatalog";
export { listOpencodeSuggestionModels } from "../engines/opencode/catalog/opencodeModelCatalog";
export { listOllamaSuggestionModels } from "../engines/ollama/catalog/ollamaModelCatalog";
export { SuggestionRequestGovernor } from "./governor/SuggestionRequestGovernor";
export { GhostPromptSessionStore } from "./session/GhostPromptSessionStore";
export type { GhostPromptSuggestDeps } from "./pipeline";
export { runGhostPromptSuggestPipeline, handleGhostPromptSuggest } from "./pipeline";
