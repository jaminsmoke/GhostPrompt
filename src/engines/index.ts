/**
 * @file API pública del dominio engines (barrel delgado).
 */
export type { ProviderId } from '../system/internals/protocols/state/provider';

export { getCompletionUiKind, getEnabledCompletionSources } from './config/completionSources';

export { resolveCompletionSourceForRequest } from './routing/resolveCompletionSource';
export { resolveProvider, type EngineProvider } from './routing/resolveProvider';

export { listMergedSuggestionModels } from './provider/mergedModelCatalog';

export { registerProviderStatusRegistry } from './runtime/providerStatusRegistry';
