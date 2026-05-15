/**
 * @file Tests de recolección de texto desde respuestas LM de VS Code (Copilot).
 */
import { describe, expect, it } from 'vitest';

import { collectLmResponse } from './collectLmResponse';

import type { LanguageModelChatResponse } from 'vscode';

/**
 * Creates a mock LanguageModelChatResponse with a text async iterator.
 * @param {string[]} chunks The text chunks to emit from the generated stream.
 * @param {number} [delayMs] Optional delay between emitted chunks in milliseconds.
 * @returns {unknown} A fake LanguageModelChatResponse for testing.
 */
function createMockResponse(chunks: string[], delayMs = 0): LanguageModelChatResponse {
  const asyncIterator = (async function* () {
    for (const chunk of chunks) {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      yield chunk;
    }
  })();

  return {
    text: {
      [Symbol.asyncIterator]: () => asyncIterator,
    },
  };
}

describe('collectLmResponse', () => {
  it('collects single chunk', async () => {
    const response = createMockResponse(['hello']);
    const result = await collectLmResponse(response, 1000);
    expect(result).toBe('hello');
  });

  it('concatenates multiple chunks', async () => {
    const response = createMockResponse(['hello', ' ', 'world']);
    const result = await collectLmResponse(response, 1000);
    expect(result).toBe('hello world');
  });

  it('returns empty string for no chunks', async () => {
    const response = createMockResponse([]);
    const result = await collectLmResponse(response, 1000);
    expect(result).toBe('');
  });

  it('handles markdown content', async () => {
    const response = createMockResponse(['```typescript\n', 'const x = 1;\n', '```']);
    const result = await collectLmResponse(response, 1000);
    expect(result).toBe('```typescript\nconst x = 1;\n```');
  });

  it('throws on timeout when no chunks arrive', async () => {
    const asyncIterator = (async function* () {
      await new Promise(() => {});
    })();
    const response = {
      text: { [Symbol.asyncIterator]: () => asyncIterator },
    } as unknown as LanguageModelChatResponse;

    await expect(collectLmResponse(response, 50)).rejects.toThrow('request-timeout');
  });
});
