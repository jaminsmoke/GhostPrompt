/**
 * @file Pruebas de exportaciones públicas del módulo engines.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => {}),
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
  'LanguageModelChatMessage': {
    'User': vi.fn(),
  },
  'CancellationTokenSource': class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({
        dispose: () => {},
      }),
    };
    cancel(): void {}
    dispose(): void {}
  },
}));

import { resolveProvider, resolveCompletionSourceForRequest, getEnabledCompletionSources, listMergedSuggestionModels, registerProviderStatusRegistry } from './index';

vitest.describe('engines index exports', () => {
  vitest.it('exports public engines API', () => {
    vitest.expect(resolveProvider).toBeTypeOf('function');
    vitest.expect(resolveCompletionSourceForRequest).toBeTypeOf('function');
    vitest.expect(getEnabledCompletionSources).toBeTypeOf('function');
    vitest.expect(listMergedSuggestionModels).toBeTypeOf('function');
    vitest.expect(registerProviderStatusRegistry).toBeTypeOf('function');
  });
});
