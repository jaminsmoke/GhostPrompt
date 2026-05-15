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
  LanguageModelChatMessage: {
    User: vi.fn(),
  },
  CancellationTokenSource: class {
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
  it('exports the engine registry helpers and catalog functions', () => {
    expect(engines.getCompletionProviderForSource).toBeTypeOf('function');
    expect(engines.getActiveCompletionProvider).toBeTypeOf('function');
    expect(engines.getCompletionProviderKind).toBeTypeOf('function');
    expect(engines.listMergedSuggestionModels).toBeTypeOf('function');
  });
});
