/**
 * @file Pruebas unitarias del selector de proveedor de completado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const inspectMock = vi.hoisted(() =>
  vi.fn(() => ({
    globalValue: undefined,
    workspaceValue: undefined,
    workspaceFolderValue: undefined,
  })),
);

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: getMock,
      inspect: inspectMock,
    }),
  },
}));

import {
  getActiveCompletionProvider,
  getCompletionProviderKind,
} from './engineRegistry';

describe('getActiveCompletionProvider', () => {
  beforeEach(() => {
    getMock.mockReset();
    inspectMock.mockReset();
    inspectMock.mockImplementation(() => ({
      globalValue: undefined,
      workspaceValue: undefined,
      workspaceFolderValue: undefined,
    }));
  });

  it('returns Copilot LM when completionProvider defaults', () => {
    getMock.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
    expect(getActiveCompletionProvider().id).toBe('copilotLm');
  });

  it('returns OpenCode when completionProvider is opencode', () => {
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === 'completionProvider' ? 'opencode' : defaultValue,
    );
    expect(getActiveCompletionProvider().id).toBe('opencode');
    expect(getCompletionProviderKind()).toBe('opencode');
  });

  it('getCompletionProviderKind tracks configuration', () => {
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === 'completionProvider' ? 'opencode' : defaultValue,
    );
    expect(getCompletionProviderKind()).toBe('opencode');
    getMock.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
    expect(getCompletionProviderKind()).toBe('copilot');
  });

  it('returns OpenCode when enabledCompletionSources is explicitly configured', () => {
    inspectMock.mockImplementation((key: string) =>
      key === 'enabledCompletionSources'
        ? {
            globalValue: ['opencode'],
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          }
        : {
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          },
    );
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === 'enabledCompletionSources'
        ? ['opencode']
        : key === 'completionProvider'
          ? 'copilot'
          : defaultValue,
    );

    expect(getActiveCompletionProvider().id).toBe('opencode');
    expect(getCompletionProviderKind()).toBe('opencode');
  });

  it('returns Copilot when multiple enabledCompletionSources are active', () => {
    inspectMock.mockImplementation((key: string) =>
      key === 'enabledCompletionSources'
        ? {
            globalValue: ['copilot', 'opencode'],
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          }
        : {
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          },
    );
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === 'enabledCompletionSources'
        ? ['copilot', 'opencode']
        : key === 'completionProvider'
          ? 'opencode'
          : defaultValue,
    );

    expect(getActiveCompletionProvider().id).toBe('copilotLm');
    expect(getCompletionProviderKind()).toBe('copilot');
  });
});
