import { describe, expect, it, vi } from 'vitest';
import { collectResponseText } from './collect';

function createMockResponse(chunks: string[], delayMs = 0): vscode.LanguageModelChatResponse {
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
  } as unknown as vscode.LanguageModelChatResponse;
}

describe('collectResponseText', () => {
  it('collects single chunk', async () => {
    const response = createMockResponse(['hello']);
    const result = await collectResponseText(response, 1000);
    expect(result).toBe('hello');
  });

  it('concatenates multiple chunks', async () => {
    const response = createMockResponse(['hello', ' ', 'world']);
    const result = await collectResponseText(response, 1000);
    expect(result).toBe('hello world');
  });

  it('returns empty string for no chunks', async () => {
    const response = createMockResponse([]);
    const result = await collectResponseText(response, 1000);
    expect(result).toBe('');
  });

  it('handles markdown content', async () => {
    const response = createMockResponse(['```typescript\n', 'const x = 1;\n', '```']);
    const result = await collectResponseText(response, 1000);
    expect(result).toBe('```typescript\nconst x = 1;\n```');
  });

  it('throws on timeout when no chunks arrive', async () => {
    const asyncIterator = (async function* () {
      await new Promise(() => {});
    })();
    const response = {
      text: { [Symbol.asyncIterator]: () => asyncIterator },
    } as unknown as vscode.LanguageModelChatResponse;

    await expect(collectResponseText(response, 50)).rejects.toThrow('request-timeout');
  });
});
