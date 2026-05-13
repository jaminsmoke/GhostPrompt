/**
 * @fileoverview Punto de entrada público del dominio “completion” (barrel).
 *
 * Motores de suggestion:
 * - **Copilot LM:** `providers/copilotLmCompletion.ts` (`vscode.lm`).
 * - **OpenCode:** `providers/opencodeLmCompletion.ts` (servidor embebido + `@opencode-ai/sdk`).
 *
 * El **host** enruta por modelo y fuentes: `getCompletionProviderForSource` +
 * `resolveCompletionSourceForRequest` (`completionSources.ts`). Con una sola fuente,
 * `getActiveCompletionProvider()` sigue siendo válido; con varias fuentes y `auto`,
 * el UI puede seguir mostrando Copilot como “primario” para el kind legacy.
 *
 * **Alias:** `requestCompletion` reexporta solo `requestCopilotLmCompletion` por
 * compatibilidad histórica; el flujo webview usa los proveedores registrados arriba.
 *
 * **Layout:** `catalog/` — listados y tiers de modelo; `context/` — bootstrap proyecto para prompts.
 */
export * from "./types";
export {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from "./suggestionLoadingUi";
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
export * from "./catalog/modelCatalog";

export { requestCopilotLmCompletion as requestCompletion } from "../engines/copilot/copilotLmEngine";

export type { CompletionProvider } from "./completionProvider";
export {
  getActiveCompletionProvider,
  getCompletionProviderForSource,
  getCompletionProviderKind,
} from "./completionProvider";
export {
  getCompletionUiKind,
  getEnabledCompletionSources,
  looksLikeOpencodeModelId,
  looksLikeOllamaModelId,
  resolveCompletionSourceForRequest,
  type CompletionSourceId,
} from "./completionSources";
export { listMergedSuggestionModels } from "./catalog/mergedModelCatalog";
export { listOpencodeSuggestionModels } from "./catalog/opencodeModelCatalog";
