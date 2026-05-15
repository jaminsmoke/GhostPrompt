/**
 * @file Pruebas de formato de ID de modelo Ollama.
 */
import { describe, expect, it } from 'vitest';

import { looksLikeOllamaModelId } from './modelId';

describe('looksLikeOllamaModelId', () => {
  it('detecta formato model:tag', () => {
    expect(looksLikeOllamaModelId('mistral:latest')).toBe(true);
    expect(looksLikeOllamaModelId('llama3:7b')).toBe(true);
    expect(looksLikeOllamaModelId('gpt-4o-mini')).toBe(false);
    expect(looksLikeOllamaModelId('anthropic/claude-3')).toBe(false);
  });
});
