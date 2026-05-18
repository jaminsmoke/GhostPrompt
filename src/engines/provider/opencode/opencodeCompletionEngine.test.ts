/**
 * @file Pruebas del motor de completions OpenCode (`requestOpencodeCompletion`).
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

import {
  OPENCODE_DEFAULT_PORT,
  type OpenCodeSdkClient,
} from '../../../system/internals/protocols/types/typeOpencodeClient';
import { emptyConfigurationInspect } from '../../../system/internals/testing/mockVscodeConfigurationInspect';

import { resetClient } from './client';
import { requestOpencodeCompletion } from './opencodeCompletionEngine';

import type * as Vscode from 'vscode';

const sessionCreateMock = vi.fn<(...args: [unknown?]) => Promise<unknown>>();
const sessionPromptMock = vi.fn<(...args: [unknown]) => Promise<unknown>>();
const sessionDeleteMock = vi.fn<(...args: [unknown]) => Promise<unknown>>();
const configGetMock = vi.fn<(...args: []) => Promise<unknown>>();
const eventSubscribeMock = vi.fn<
  (options: { signal: AbortSignal }) => Promise<{ stream: AsyncIterable<unknown> }>
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

const createOpencodeClientMock = (_options: unknown): OpenCodeSdkClient => fakeSdkClient;

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeClient: createOpencodeClientMock,
}));

const getCfgMock = vi.fn<(key: string, fallback?: unknown) => unknown>();
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback?: unknown) => getCfgMock(key, fallback),
      inspect: vi.fn(() => emptyConfigurationInspect),
    }),
  },
}));

/**
 * Creates a mock cancellation token for OpenCode tests.
 * @returns {object} Token compatible con CancellationToken de VS Code.
 */
function makeToken() {
  const listeners: (() => void)[] = [];
  return {
    isCancellationRequested: false,
    onCancellationRequested: (callback: () => void) => {
      listeners.push(callback);
      return {
        dispose: () => {},
      };
    },
    cancel: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

vitest.beforeEach(() => {
  resetClient();
  vi.clearAllMocks();
  getCfgMock.mockImplementation((key: string, fallback?: unknown) => {
    if (key === 'opencodePort') {
      return OPENCODE_DEFAULT_PORT;
    }
    if (key === 'opencodeAuthToken') {
      return fallback;
    }
    return fallback;
  });
  configGetMock.mockResolvedValue({ data: { status: 'ok' } });
  sessionCreateMock.mockResolvedValue({ data: { id: 'sess-1' } });
  sessionPromptMock.mockResolvedValue({
    data: { parts: [{ type: 'text', text: ' suggested continuation' }] },
  });
  sessionDeleteMock.mockResolvedValue();
});

vitest.afterEach(() => {
  resetClient();
});

vitest.describe('requestOpencodeCompletion', () => {
  vitest.it('returns suggestion when prompt succeeds', async () => {
    const token = makeToken();
    const result = await requestOpencodeCompletion('Write a greeting for the team meeting.', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
      style: 'balanced',
    });

    vitest.expect(result.kind).toBe('suggestion');
    if (result.kind === 'suggestion') {
      vitest.expect(result.suggestion.length).toBeGreaterThan(0);
      vitest.expect(result.model?.id).toBe('anthropic/claude-3');
    }
    vitest.expect(sessionCreateMock).toHaveBeenCalled();
    vitest.expect(sessionPromptMock).toHaveBeenCalled();
  });

  vitest.it('returns empty no-model when health check fails', async () => {
    configGetMock.mockRejectedValue(new Error('connection refused'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
    vitest.expect(sessionPromptMock).not.toHaveBeenCalled();
  });

  vitest.it('returns empty no-model when no model specified', async () => {
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
    vitest.expect(sessionPromptMock).not.toHaveBeenCalled();
  });

  vitest.it('returns error when prompt throws', async () => {
    sessionPromptMock.mockRejectedValue(new Error('Prompt rejected'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    vitest.expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      vitest.expect(result.message).toBe('Prompt rejected');
    }
  });

  vitest.it('returns empty request-timeout on timeout error', async () => {
    sessionPromptMock.mockRejectedValue(new Error('request timed out'));
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  vitest.it('returns empty request-timeout when token is already cancelled', async () => {
    const token = makeToken();
    token.isCancellationRequested = true;
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  vitest.it('reuses session from pool for sequential suggestions', async () => {
    const token = makeToken();
    const options = {
      token: token as unknown as Vscode.CancellationToken,
      policy: 'anyModel' as const,
      preferredModelId: 'anthropic/claude-3',
      style: 'balanced' as const,
    };

    await requestOpencodeCompletion('First line for suggest.', options);
    await requestOpencodeCompletion('Second distinct input text.', options);

    vitest.expect(sessionCreateMock).toHaveBeenCalledTimes(1);
    vitest.expect(sessionPromptMock).toHaveBeenCalledTimes(2);
  });

  vitest.it('returns empty when response has no text parts', async () => {
    sessionPromptMock.mockResolvedValue({
      data: { parts: [] },
    });
    const token = makeToken();
    const result = await requestOpencodeCompletion('hello world', {
      token,
      policy: 'anyModel',
      preferredModelId: 'anthropic/claude-3',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'empty-response' });
  });
});
