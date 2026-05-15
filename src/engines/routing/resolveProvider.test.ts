/**
 * @file Pruebas de resolveProvider.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: vi.fn() }) },
  lm: { selectChatModels: vi.fn() },
  ['LanguageModelChatMessage']: { ['User']: vi.fn() },
  ['CancellationTokenSource']: class {
    token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
    cancel() {}
    dispose() {}
  },
}));

import { resolveProvider } from './resolveProvider';

describe('resolveProvider', () => {
  it('returns ollama provider with id ollama', () => {
    const provider = resolveProvider('ollama');
    expect(provider.id).toBe('ollama');
    expect(provider.requestCompletion).toBeTypeOf('function');
  });

  it('returns copilotLm for copilot', () => {
    const provider = resolveProvider('copilot');
    expect(provider.id).toBe('copilotLm');
  });

  it('returns opencode for opencode', () => {
    const provider = resolveProvider('opencode');
    expect(provider.id).toBe('opencode');
  });

  it('defaults to copilotLm for unknown source', () => {
    const provider = resolveProvider('unknown' as 'copilot');
    expect(provider.id).toBe('copilotLm');
  });
});
