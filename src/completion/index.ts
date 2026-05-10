/**
 * @fileoverview Punto de entrada público del dominio “completion” (barrel).
 *
 * Implementación LM: `providers/copilotLmCompletion.ts`. El host debe usar
 * `getActiveCompletionProvider()` para permitir otros motores sin acoplarse a Copilot.
 *
 * Alias histórico: las importaciones desde `CopilotCompletion` deben migrar a `completion` o este index.
 */
export * from "./types";
export {
  suggestionLoadingStatusText,
  type SuggestionLoadingPhase,
} from "./suggestionLoadingUi";
export * from "./instruction";
export * from "./normalize";
export * from "./language";
export * from "./streaming";
export * from "./modelCatalog";

export { requestCopilotLmCompletion as requestCompletion } from "./providers/copilotLmCompletion";

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
  resolveCompletionSourceForRequest,
  type CompletionSourceId,
} from "./completionSources";
export { listMergedSuggestionModels } from "./mergedModelCatalog";
export { listOpencodeSuggestionModels } from "./opencodeModelCatalog";
