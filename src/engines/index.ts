export {
  CompletionProvider,
  getCompletionProviderForSource,
  getActiveCompletionProvider,
  getCompletionProviderKind,
} from './engineRegistry';

export { listMergedSuggestionModels } from './catalog/mergedModelCatalog';

export * from './copilot/index';
export * from './ollama/index';
export * from './opencode/index';
