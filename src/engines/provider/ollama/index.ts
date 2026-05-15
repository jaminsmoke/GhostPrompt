/**
 * @file Exportaciones públicas del engine Ollama.
 */
export { listModels, generate } from './http/ollamaApiClient';
export { requestOllamaCompletion } from './completion/ollamaCompletionEngine';
export { listOllamaSuggestionModels } from './catalog/ollamaModelCatalog';
export {
  normalizeOllamaModels,
  ollamaModelToDescriptor,
  type OllamaApiModelRecord,
} from './catalog/normalizeOllamaModels';
export { ollamaModelManager } from './host/ollamaModelManager';
export type { OllamaManagerState } from './host/ollamaModelManager';
export type {
  OllamaModel,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaClientOptions,
} from './http/ollamaTypes';
