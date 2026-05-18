/**
 * @file Tests de recolección de texto desde respuestas LM de VS Code (Copilot).
 */

import * as vitest from 'vitest';

import { collectLmResponse } from './collectLmResponse';

import type * as Vscode from 'vscode';

const TEST_STREAM_TIMEOUT_MS = 50;

/**
 * Creates a mock Vscode.LanguageModelChatResponse with a text async iterator.
 * @param {string[]} chunks - The text chunks to emit from the generated stream.
 * @param {number} [delayMs] - Optional delay between emitted chunks in milliseconds.
 * @returns {unknown} A fake Vscode.LanguageModelChatResponse for testing.
 */
function createMockResponse(chunks: string[], delayMs = 0): Vscode.LanguageModelChatResponse {
  /**
   * Emite trozos de texto simulando latencia opcional entre fragmentos.
   * @param {number} index - Índice del trozo actual en `chunks`.
   * @yields {string} Siguiente fragmento de la respuesta simulada.
   */
  async function* emitChunks(index: number): AsyncGenerator<string> {
    if (index >= chunks.length) {
      return;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
    yield chunks[index];
    yield* emitChunks(index + 1);
  }

  const asyncIterator = emitChunks(0);

  return {
    text: {
      [Symbol.asyncIterator]: () => asyncIterator,
    },
  };
}

vitest.describe('collectLmResponse', () => {
  vitest.it('collects single chunk', async () => {
    const response = createMockResponse(['hello']);
    const result = await collectLmResponse(response, 1000);
    vitest.expect(result).toBe('hello');
  });

  vitest.it('concatenates multiple chunks', async () => {
    const response = createMockResponse(['hello', ' ', 'world']);
    const result = await collectLmResponse(response, 1000);
    vitest.expect(result).toBe('hello world');
  });

  vitest.it('returns empty string for no chunks', async () => {
    const response = createMockResponse([]);
    const result = await collectLmResponse(response, 1000);
    vitest.expect(result).toBe('');
  });

  vitest.it('handles markdown content', async () => {
    const response = createMockResponse(['```typescript\n', 'const x = 1;\n', '```']);
    const result = await collectLmResponse(response, 1000);
    vitest.expect(result).toBe('```typescript\nconst x = 1;\n```');
  });

  vitest.it('throws on timeout when no chunks arrive', async () => {
    const asyncIterator = {
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise<IteratorResult<string>>(() => {}),
      }),
    };
    const response = {
      text: asyncIterator,
    } as unknown as Vscode.LanguageModelChatResponse;

    await vitest
      .expect(collectLmResponse(response, TEST_STREAM_TIMEOUT_MS))
      .rejects.toThrow('request-timeout');
  });
});
