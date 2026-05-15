/**
 * @file Punto de entrada de la integración OpenCode para `engines`.
 */
export { requestOpencodeCompletion } from './opencodeCompletionEngine';
export { listOpencodeSuggestionModels } from './catalog/opencodeModelCatalog';
export { normalizeOpencodeProviderModels } from './catalog/normalizeOpencodeProviderModels';
export { classifyOpencodeModelTier } from './catalog/opencodeModelTier';
export type { RawOpencodeProviderModel } from './catalog/normalizeOpencodeProviderModels';
export type { OpencodeTierResult } from './catalog/opencodeModelTier';
