/**
 * @file Pruebas del motor de completions Ollama.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

const configGetMock = vi.hoisted(() => vi.fn());

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: configGetMock,
    }),
  },
}));

const mockListModels = vi.hoisted(() => vi.fn());
const mockGenerate = vi.hoisted(() => vi.fn());

vi.mock('../http/ollamaApiClient', () => ({
  listModels: mockListModels,
  generate: mockGenerate,
}));

import { requestOllamaCompletion } from './ollamaCompletionEngine';

/**
 * Creates a minimal cancellation token-like object for tests.
 * @returns {object} Token compatible con CancellationToken de VS Code.
 */
function makeToken() {
  return {
    isCancellationRequested: false,
    onCancellationRequested: (_callback: () => void) => ({
      dispose: () => {},
    }),
  };
}

/**
 * Restaura mocks del motor Ollama antes de cada test.
 * @returns {void}
 */
function resetOllamaCompletionMocks(): void {
  configGetMock.mockReset();
  mockListModels.mockReset();
  mockGenerate.mockReset();

  configGetMock.mockImplementation((key: string, defaultValue: unknown) => {
    if (key === 'ollamaBaseUrl') {
      return 'http://localhost:11434';
    }
    if (key === 'ollamaExcludedModelIds') {
      return [];
    }
    return defaultValue;
  });
}

vitest.describe('requestOllamaCompletion (model resolution)', () => {
  vitest.beforeEach(resetOllamaCompletionMocks);

  vitest.it('returns suggestion when generate succeeds with explicit model', async () => {
    mockGenerate.mockResolvedValue(' suggested completion text');

    const token = makeToken();
    const result = await requestOllamaCompletion('Write a function', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
      style: 'balanced',
    });

    vitest.expect(result.kind).toBe('suggestion');
    if (result.kind === 'suggestion') {
      vitest.expect(result.suggestion.length).toBeGreaterThan(0);
      vitest.expect(result.model?.id).toBe('mistral:latest');
    }
    vitest.expect(mockGenerate).toHaveBeenCalledWith(
      vitest.expect.stringContaining('Write a function'),
      'mistral:latest',
      vitest.expect.anything(),
    );
  });

  vitest.it('resolves auto model from listModels when preferredModelId is auto', async () => {
    mockListModels.mockResolvedValue([
      { name: 'llama3:latest', 'modified_at': '', size: 0, digest: '' },
    ]);
    mockGenerate.mockResolvedValue(' completion');

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'auto',
    });

    vitest.expect(result.kind).toBe('suggestion');
    vitest.expect(mockGenerate).toHaveBeenCalledWith(
      vitest.expect.any(String),
      'llama3:latest',
      vitest.expect.anything(),
    );
  });

  vitest.it('returns empty no-model when auto resolves and listModels is empty', async () => {
    mockListModels.mockResolvedValue([]);

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'auto',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
  });

  vitest.it('returns empty no-model when listModels throws', async () => {
    mockListModels.mockRejectedValue(new Error('connection refused'));

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'auto',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
  });
});

vitest.describe('requestOllamaCompletion (exclusions y errores)', () => {
  vitest.beforeEach(resetOllamaCompletionMocks);

  vitest.it('respects excluded model ids when resolving auto', async () => {
    configGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'ollamaBaseUrl') {
        return 'http://localhost:11434';
      }
      if (key === 'ollamaExcludedModelIds') {
        return ['llama3:latest'];
      }
      return defaultValue;
    });

    mockListModels.mockResolvedValue([
      { name: 'llama3:latest', 'modified_at': '', size: 0, digest: '' },
      { name: 'mistral:latest', 'modified_at': '', size: 0, digest: '' },
    ]);
    mockGenerate.mockResolvedValue(' completion');

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'auto',
    });

    vitest.expect(result.kind).toBe('suggestion');
    vitest.expect(mockGenerate).toHaveBeenCalledWith(
      vitest.expect.any(String),
      'mistral:latest',
      vitest.expect.anything(),
    );
  });

  vitest.it('returns empty no-model when all models are excluded', async () => {
    configGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'ollamaBaseUrl') {
        return 'http://localhost:11434';
      }
      if (key === 'ollamaExcludedModelIds') {
        return ['llama3:latest', 'mistral:latest'];
      }
      return defaultValue;
    });

    mockListModels.mockResolvedValue([
      { name: 'llama3:latest', 'modified_at': '', size: 0, digest: '' },
      { name: 'mistral:latest', 'modified_at': '', size: 0, digest: '' },
    ]);

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'auto',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
  });

  vitest.it('returns empty request-timeout when token is cancelled before generate check', async () => {
    const token = makeToken();
    (token as unknown as { isCancellationRequested: boolean }).isCancellationRequested = true;

    mockGenerate.mockResolvedValue(' some text');

    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  vitest.it('returns error when generate throws an unknown error', async () => {
    mockGenerate.mockRejectedValue(new Error('unknown model error'));

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
    });

    vitest.expect(result).toEqual({ kind: 'error', message: 'unknown model error' });
  });

  vitest.it('returns empty request-timeout on timeout-like error', async () => {
    mockGenerate.mockRejectedValue(new Error('timed out'));

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  vitest.it('returns empty no-model on connection refused error', async () => {
    mockGenerate.mockRejectedValue(new Error('ECONNREFUSED'));

    const token = makeToken();
    const result = await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
  });

  vitest.it('calls onLoadingPhase with ollama-start and ollama-generating', async () => {
    mockGenerate.mockResolvedValue('  completion');

    const phases: string[] = [];
    const token = makeToken();
    await requestOllamaCompletion('hello', {
      policy: 'anyModel',
      token,
      preferredModelId: 'mistral:latest',
      onLoadingPhase: (p) => phases.push(p),
    });

    vitest.expect(phases).toEqual(['ollama-start', 'ollama-loading', 'ollama-generating']);
  });
});
