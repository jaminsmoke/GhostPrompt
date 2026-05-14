export { listModels, generate } from './ollamaApiClient';
export { requestOllamaCompletion } from './ollamaLmEngine';
export { listOllamaSuggestionModels } from './catalog/ollamaModelCatalog';
export {
  normalizeOllamaModels,
  ollamaModelToDescriptor,
  type OllamaApiModelRecord,
} from './catalog/normalizeOllamaModels';
export { ollamaModelManager } from './ollamaModelManager';
export type { OllamaManagerState } from './ollamaModelManager';
export type {
  OllamaModel,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaClientOptions,
} from './ollamaTypes';
