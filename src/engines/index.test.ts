/**
 * @file Pruebas de exportaciones públicas del módulo engines.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => undefined),
      inspect: vi.fn(() => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
    }),
  },
  lm: {
    selectChatModels: vi.fn(),
  },
  ['LanguageModelChatMessage']: {
    ['User']: vi.fn(),
  },
  ['CancellationTokenSource']: class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose: () => {} }),
    };
    cancel() {}
    dispose() {}
  },
}));

import * as engines from './index';

describe('engines index exports', () => {
  it('exports public engines API', () => {
    expect(engines.resolveProvider).toBeTypeOf('function');
    expect(engines.resolveCompletionSourceForRequest).toBeTypeOf('function');
    expect(engines.getEnabledCompletionSources).toBeTypeOf('function');
    expect(engines.listMergedSuggestionModels).toBeTypeOf('function');
    expect(engines.registerProviderStatusRegistry).toBeTypeOf('function');
  });
});
