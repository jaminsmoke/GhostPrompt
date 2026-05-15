/**
 * @file Pruebas del motor de completions OpenCode (`requestOpencodeCompletion`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import { resetClient } from './client';
import { requestOpencodeCompletion } from './opencodeCompletionEngine';

import type { OpenCodeSdkClient } from '../../../system/internals/protocols/types/opencodeClient';

const sessionCreateMock = vi.fn<(...args: [unknown?]) => Promise<unknown>>();
const sessionPromptMock = vi.fn<(...args: [unknown]) => Promise<unknown>>();
const sessionDeleteMock = vi.fn<(...args: [unknown]) => Promise<unknown>>();
const configGetMock = vi.fn<(...args: []) => Promise<unknown>>();
const eventSubscribeMock = vi.fn<
  (opts: { signal: AbortSignal }) => Promise<{ stream: AsyncIterable<unknown> }>
>();

const fakeSdkClient: OpenCodeSdkClient = {
  config: { get: configGetMock },
  session: {
    create: sessionCreateMock,
    prompt: sessionPromptMock,
    delete: sessionDeleteMock,
  },
  event: { subscribe: eventSubscribeMock },
};

const createOpencodeClientMock = (_opts: unknown): OpenCodeSdkClient => fakeSdkClient;

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeClient: createOpencodeClientMock,
}));

const getCfgMock = vi.fn<(key: string, fallback?: unknown) => unknown>();
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback?: unknown) => getCfgMock(key, fallback),
      inspect: vi.fn(() => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
    }),
  },
}));

/**
 * Creates a mock cancellation token for OpenCode tests.
 * @returns {{ isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => { dispose(): void } }} A token-like object with cancellation support.
 */
function makeToken() {
  const listeners: Array<() => void> = [];
  return {
    isCancellationRequested: false,
    onCancellationRequested: (cb: () => void) => {
      listeners.push(cb);
      return { dispose: () => {} };
    },
    cancel: () => {
      listeners.forEach((l) => l());
    },
  };
}

beforeEach(() => {
  resetClient();
  vi.clearAllMocks();
  getCfgMock.mockImplementation((key: string, fallback?: unknown) => {
    if (key === 'opencodePort') {return 4096;}
    if (key === 'opencodeAuthToken') {return undefined;}
    return fallback;
  });
  configGetMock.mockResolvedValue({ data: { status: 'ok' } });
  sessionCreateMock.mockResolvedValue({ data: { id: 'sess-1' } });
  sessionPromptMock.mockResolvedValue({
    data: { parts: [{ type: 'text', text: ' suggested continuation' }] },
  });
  sessionDeleteMock.mockResolvedValue(undefined);
});

afterEach(() => {
  resetClient();
});

describe('requestOpencodeCompletion', () => {
  it('returns suggestion when prompt succeeds', async () => {
    const token = makeToken();
    const result = await requestOpencodeCompletion('Write a greeting for the team meeting.', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
      style: 'balanced',
    });

    expect(result.kind).toBe('suggestion');
    if (result.kind === 'suggestion') {
      expect(result.suggestion.length).toBeGreaterThan(0);
      expect(result.model?.id).toBe('anthropic/claude-3');
    }
    expect(sessionCreateMock).toHaveBeenCalled();
    expect(sessionPromptMock).toHaveBeenCalled();
  });

  it('returns empty no-model when health check fails', async () => {
    configGetMock.mockRejectedValue(new Error('connection refused'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
    expect(sessionPromptMock).not.toHaveBeenCalled();
  });

  it('returns empty no-model when no model specified', async () => {
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
    });

    expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
    expect(sessionPromptMock).not.toHaveBeenCalled();
  });

  it('returns error when prompt throws', async () => {
    sessionPromptMock.mockRejectedValue(new Error('Prompt rejected'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toBe('Prompt rejected');
    }
  });

  it('returns empty request-timeout on timeout error', async () => {
    sessionPromptMock.mockRejectedValue(new Error('request timed out'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  it('returns empty request-timeout when token is already cancelled', async () => {
    const token = makeToken();
    token.isCancellationRequested = true;
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  it('reuses session from pool for sequential suggestions', async () => {
    const token = makeToken();
    const opts = {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel' as const,
      preferredModelId: 'anthropic/claude-3',
      style: 'balanced' as const,
    };

    await requestOpencodeCompletion('First line for suggest.', opts);
    await requestOpencodeCompletion('Second distinct input text.', opts);

    expect(sessionCreateMock).toHaveBeenCalledTimes(1);
    expect(sessionPromptMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty when response has no text parts', async () => {
    sessionPromptMock.mockResolvedValue({
      data: { parts: [] },
    });
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token: token as unknown as import('vscode').CancellationToken,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    expect(result).toEqual({ kind: 'empty', reason: 'empty-response' });
  });
});
