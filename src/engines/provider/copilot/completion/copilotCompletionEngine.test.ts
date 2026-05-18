/**
 * @file Pruebas del motor Copilot LM (`completion/copilotCompletionEngine`).
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

const { selectChatModelsMock, userMessageMock } = vi.hoisted(() => ({
  selectChatModelsMock: vi.fn(),
  userMessageMock: vi.fn((instruction: string) => ({ instruction })),
}));

vi.mock('vscode', () => ({
  lm: {
    selectChatModels: selectChatModelsMock,
  },
  'LanguageModelChatMessage': {
    'User': userMessageMock,
  },
  'CancellationTokenSource': class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({
        dispose: () => {},
      }),
    };
    cancel() {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
}));

import { buildCompletionInstruction } from '../../../../sugcore/rules/instruction';
import {
  listSuggestionModels,
  selectModelByPolicy,
} from '../catalog/modelCatalog';

import { requestCopilotLmCompletion as requestCompletion } from './copilotCompletionEngine';

/**
 * Creates a mock async iterable that yields the provided chunks sequentially.
 * @param {string[]} chunks - Text chunks to emit through the async iterator.
 * @returns {AsyncIterable<string>} An async iterable of strings.
 */
function createTextStream(chunks: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve();
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * Creates a mock async iterable that never resolves, simulating a hanging stream.
 * @returns {AsyncIterable<string>} An async iterable that never completes.
 */
function createHangingTextStream(): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          new Promise<IteratorResult<string>>(() => {}),
      };
    },
  };
}

/**
 * Creates a minimal cancellation token for tests.
 * @returns {object} Token compatible con CancellationToken de VS Code.
 */
function createToken() {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({
      dispose: () => {},
    }),
  };
}

vitest.describe('CopilotCompletion', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
  });

  vitest.it('devuelve empty no-model cuando no hay modelos', async () => {
    selectChatModelsMock.mockResolvedValueOnce([]);

    const result = await requestCompletion('hola', {
      token: createToken(),
      policy: 'anyModel',
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'no-model' });
  });

  vitest.it('devuelve suggestion cuando el modelo responde texto', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createTextStream([' continuacion ', 'util']),
    });
    selectChatModelsMock.mockResolvedValueOnce([{ sendRequest }]);

    const result = await requestCompletion('Escribe', {
      token: createToken(),
      policy: 'anyModel',
    });

    vitest.expect(result).toEqual(
      vitest.expect.objectContaining({
        kind: 'suggestion',
        suggestion: ' continuacion util',
      }),
    );
    vitest.expect(sendRequest).toHaveBeenCalledOnce();
    vitest.expect(userMessageMock).toHaveBeenCalledTimes(1);
  });

  vitest.it('requestCompletion envia instruccion simple sin directivas de estilo', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createTextStream([' ok']),
    });
    selectChatModelsMock.mockResolvedValue([{ sendRequest }]);

    await requestCompletion('Hola', {
      token: createToken(),
      policy: 'anyModel',
    });
    vitest.expect(userMessageMock.mock.calls[0][0]).toContain('Complete the following text');
    vitest.expect(userMessageMock.mock.calls[0][0]).toContain('Hola');
    vitest.expect(userMessageMock.mock.calls[0][0]).not.toContain('STYLE_');
  });

  vitest.it('devuelve request-timeout si el modelo no responde en el tiempo limite', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      text: createHangingTextStream(),
    });
    selectChatModelsMock.mockResolvedValueOnce([{ sendRequest }]);

    const result = await requestCompletion('Escribe', {
      token: createToken(),
      policy: 'anyModel',
      requestTimeoutMs: 20,
    });

    vitest.expect(result).toEqual({ kind: 'empty', reason: 'request-timeout' });
  });

  vitest.it('devuelve el texto crudo del modelo incluso si parece una negativa (post-procesado en runtime)', async () => {
    const refusal = "I'm sorry, I can't assist with that.";
    const sendRequest = vi.fn().mockResolvedValue({
      text: createTextStream([refusal]),
    });
    selectChatModelsMock.mockResolvedValueOnce([{ sendRequest }]);

    const result = await requestCompletion('Escribe', {
      token: createToken(),
      policy: 'anyModel',
    });

    vitest.expect(result).toEqual(
      vitest.expect.objectContaining({
        kind: 'suggestion',
        suggestion: refusal,
      }),
    );
  });

  vitest.it('selectModelByPolicy prioriza modelo no premium en modo seguro', () => {
    const models = [{ id: 'gpt-5-pro' }, { id: 'gpt-4o-mini' }] as never[];

    const selected = selectModelByPolicy(models, 'nonPremiumOnly');
    vitest.expect(selected).toEqual(models[1]);
  });

  vitest.it('selectModelByPolicy respeta preferredModelId cuando es compatible', () => {
    const models = [{ id: 'gpt-4o-mini' }, { id: 'claude-3.5-haiku' }] as never[];
    const selected = selectModelByPolicy(models, 'nonPremiumOnly', 'claude-3.5-haiku');
    vitest.expect(selected).toEqual(models[1]);
  });

  vitest.it('selectModelByPolicy ignora preferred premium en modo seguro', () => {
    const models = [{ id: 'gpt-5-pro' }, { id: 'gpt-4o-mini' }] as never[];
    const selected = selectModelByPolicy(models, 'nonPremiumOnly', 'gpt-5-pro');
    vitest.expect(selected).toEqual(models[1]);
  });

  vitest.it('listSuggestionModels devuelve label con tier', async () => {
    selectChatModelsMock.mockResolvedValueOnce([{ id: 'gpt-4o-mini', name: 'GPT-4o mini' }]);
    const models = await listSuggestionModels('anyModel');
    vitest.expect(models).toEqual([
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        tier: 'included',
        provider: 'OpenAI',
        completionSource: 'copilot',
      },
    ]);
  });

  vitest.it('listSuggestionModels elimina modelos duplicados por etiqueta visible', async () => {
    selectChatModelsMock.mockResolvedValueOnce([
      { id: 'gpt-4o', name: 'GPT-4o', pricing: '0x' },
      { id: 'copilot-fast-gpt4o', name: 'GPT-4o', pricing: '0x' },
      { id: 'gpt-4o-alt', name: 'GPT-4o', pricing: '0x' },
    ]);
    const models = await listSuggestionModels('anyModel');
    vitest.expect(models).toEqual([
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        tier: 'included',
        pricing: '0x',
        provider: 'OpenAI',
        completionSource: 'copilot',
      },
    ]);
  });

  vitest.it('listSuggestionModels deduplica ids versionados del mismo modelo visible', async () => {
    selectChatModelsMock.mockResolvedValueOnce([
      { id: 'gpt-4o', name: 'GPT-4o', pricing: '0x' },
      { id: 'gpt-4o-2024-11-20', name: 'GPT-4o', pricing: '0x' },
    ]);
    const models = await listSuggestionModels('anyModel');
    vitest.expect(models).toEqual([
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        tier: 'included',
        pricing: '0x',
        provider: 'OpenAI',
        completionSource: 'copilot',
      },
    ]);
  });

  vitest.it('buildCompletionInstruction genera instruccion simple', () => {
    const instruction = buildCompletionInstruction('Escribe una propuesta');

    vitest.expect(instruction).toContain('Complete the following text as a natural continuation');
    vitest.expect(instruction).toContain('Only output the continuation itself');
    vitest.expect(instruction).toContain('Escribe una propuesta');
    vitest.expect(instruction).not.toContain('STYLE_');
    vitest.expect(instruction).not.toContain('Partial text to continue');
  });

  vitest.it('buildCompletionInstruction no repite contexto ignorado', () => {
    const instruction = buildCompletionInstruction('Create a test plan');
    vitest.expect(instruction).toContain('Create a test plan');
  });
});
