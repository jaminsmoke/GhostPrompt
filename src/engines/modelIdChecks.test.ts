/**
 * @file Pruebas de validación de IDs de modelo.
 */
import { describe, expect, it } from 'vitest';

import { looksLikeOllamaModelId, looksLikeOpencodeModelId } from './modelIdChecks';

describe('looksLikeOllamaModelId', () => {
  it('detecta formato model:tag', () => {
    expect(looksLikeOllamaModelId('mistral:latest')).toBe(true);
    expect(looksLikeOllamaModelId('llama3:7b')).toBe(true);
    expect(looksLikeOllamaModelId('gpt-4o-mini')).toBe(false);
    expect(looksLikeOllamaModelId('anthropic/claude-3')).toBe(false);
  });
});

describe('looksLikeOpencodeModelId', () => {
  it('detecta formato provider/model', () => {
    expect(looksLikeOpencodeModelId('foo/bar')).toBe(true);
    expect(looksLikeOpencodeModelId('gpt-4o-mini')).toBe(false);
  });
});
