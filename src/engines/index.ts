/**
 * @file Exportaciones públicas del módulo engines.
 */
export type { CompletionSourceId } from './completionSourceId';

export {
  CompletionProvider,
  getCompletionProviderForSource,
  getActiveCompletionProvider,
  getCompletionProviderKind,
} from './engineRegistry';

export { getCompletionUiKind, getEnabledCompletionSources } from './config/completionSources';

export { resolveCompletionSourceForRequest } from './routing/resolveCompletionSource';

export { listMergedSuggestionModels } from './catalog/mergedModelCatalog';

export * from './status';
export * from './copilot/index';
export * from './ollama/index';
export * from './opencode/index';
