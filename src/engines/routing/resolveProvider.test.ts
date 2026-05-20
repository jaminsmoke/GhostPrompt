/**
 * @file Pruebas de resolveProvider.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: vi.fn() }) },
  lm: { selectChatModels: vi.fn() },
  'LanguageModelChatMessage': { 'User': vi.fn() },
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

import { resolveProvider } from './resolveProvider';

vitest.describe('resolveProvider', () => {
  vitest.it('returns ollama provider with id ollama', () => {
    const provider = resolveProvider('ollama');
    vitest.expect(provider.id).toBe('ollama');
    vitest.expect(provider.requestCompletion).toBeTypeOf('function');
  });

  vitest.it('returns copilotLm for copilot', () => {
    const provider = resolveProvider('copilot');
    vitest.expect(provider.id).toBe('copilotLm');
  });

  vitest.it('returns opencode for opencode', () => {
    const provider = resolveProvider('opencode');
    vitest.expect(provider.id).toBe('opencode');
  });

  vitest.it('defaults to copilotLm for unknown source', () => {
    const provider = resolveProvider('unknown' as 'copilot');
    vitest.expect(provider.id).toBe('copilotLm');
  });
});
