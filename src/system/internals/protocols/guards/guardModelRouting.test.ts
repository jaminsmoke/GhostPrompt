/**
 * @file Pruebas de heurísticas de id de modelo para enrutado.
 */

import * as vitest from 'vitest';

import { looksLikeOllamaModelId, looksLikeOpencodeModelId } from './guardModelRouting';

vitest.describe('looksLikeOllamaModelId', () => {
  vitest.it('detecta formato model:tag', () => {
    vitest.expect(looksLikeOllamaModelId('mistral:latest')).toBe(true);
    vitest.expect(looksLikeOllamaModelId('llama3:7b')).toBe(true);
    vitest.expect(looksLikeOllamaModelId('gpt-4o-mini')).toBe(false);
    vitest.expect(looksLikeOllamaModelId('anthropic/claude-3')).toBe(false);
  });
});

vitest.describe('looksLikeOpencodeModelId', () => {
  vitest.it('detecta formato provider/model', () => {
    vitest.expect(looksLikeOpencodeModelId('foo/bar')).toBe(true);
    vitest.expect(looksLikeOpencodeModelId('gpt-4o-mini')).toBe(false);
  });
});
