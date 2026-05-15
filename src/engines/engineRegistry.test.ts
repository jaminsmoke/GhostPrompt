import { afterEach, describe, expect, it, vi } from 'vitest';

const { getEnabledCompletionSourcesMock } = vi.hoisted(() => ({
  getEnabledCompletionSourcesMock: vi.fn(() => []),
}));

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
}));

vi.mock('../system/internals/config/sources', () => ({
  getEnabledCompletionSources: getEnabledCompletionSourcesMock,
}));

import {
  getActiveCompletionProvider,
  getCompletionProviderForSource,
  getCompletionProviderKind,
} from './engineRegistry';

describe('engineRegistry', () => {
  afterEach(() => {
    vi.clearAllMocks();
    getEnabledCompletionSourcesMock.mockReturnValue([]);
  });
  it('getCompletionProviderForSource returns ollama provider with id ollama', () => {
    const provider = getCompletionProviderForSource('ollama');
    expect(provider.id).toBe('ollama');
    expect(provider.requestCompletion).toBeDefined();
  });

  it('getCompletionProviderForSource returns copilotLm for copilot', () => {
    const provider = getCompletionProviderForSource('copilot');
    expect(provider.id).toBe('copilotLm');
  });

  it('getCompletionProviderForSource returns opencode for opencode', () => {
    const provider = getCompletionProviderForSource('opencode');
    expect(provider.id).toBe('opencode');
  });

  it('getCompletionProviderForSource defaults to copilotLm for unknown source', () => {
    const provider = getCompletionProviderForSource('unknown' as any);
    expect(provider.id).toBe('copilotLm');
  });

  it('getActiveCompletionProvider returns copilotLm when no sources configured', () => {
    const provider = getActiveCompletionProvider();
    expect(provider.id).toBe('copilotLm');
  });

  it('getActiveCompletionProvider returns ollama when only ollama is enabled', () => {
    getEnabledCompletionSourcesMock.mockReturnValue(['ollama']);
    const provider = getActiveCompletionProvider();
    expect(provider.id).toBe('ollama');
  });

  it('getActiveCompletionProvider defaults to copilotLm when multiple sources are enabled', () => {
    getEnabledCompletionSourcesMock.mockReturnValue(['ollama', 'opencode']);
    const provider = getActiveCompletionProvider();
    expect(provider.id).toBe('copilotLm');
  });

  it('getCompletionProviderKind returns ollama when only ollama is enabled', () => {
    getEnabledCompletionSourcesMock.mockReturnValue(['ollama']);
    expect(getCompletionProviderKind()).toBe('ollama');
  });

  it('getCompletionProviderKind returns copilot when multiple sources are enabled', () => {
    getEnabledCompletionSourcesMock.mockReturnValue(['ollama', 'opencode']);
    expect(getCompletionProviderKind()).toBe('copilot');
  });
});
