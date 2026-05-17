/**
 * @file Pruebas de heurística de id Ollama para enrutado.
 */

import * as vitest from 'vitest';

import { looksLikeOllamaModelId } from './routingModelId';

vitest.describe('looksLikeOllamaModelId', () => {
  vitest.it('detecta formato model:tag', () => {
    vitest.expect(looksLikeOllamaModelId('mistral:latest')).toBe(true);
    vitest.expect(looksLikeOllamaModelId('llama3:7b')).toBe(true);
    vitest.expect(looksLikeOllamaModelId('gpt-4o-mini')).toBe(false);
    vitest.expect(looksLikeOllamaModelId('anthropic/claude-3')).toBe(false);
  });
});
