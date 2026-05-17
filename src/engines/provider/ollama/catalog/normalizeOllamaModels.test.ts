/**
 * @file Pruebas de normalización de modelos Ollama.
 */
import * as vitest from 'vitest';

import { normalizeOllamaModels, ollamaModelToDescriptor } from './normalizeOllamaModels';

vitest.describe('normalizeOllamaModels', () => {
  vitest.it('returns an empty array for missing input', () => {
    vitest.expect(normalizeOllamaModels()).toEqual([]);
    vitest.expect(normalizeOllamaModels()).toEqual([]);
  });

  vitest.it('returns an empty array when the input is not an array', () => {
    vitest.expect(normalizeOllamaModels({})).toEqual([]);
    vitest.expect(normalizeOllamaModels('not an array')).toEqual([]);
  });

  vitest.it('filters out invalid Ollama model records', () => {
    const raw = [
      { name: 'mistral:latest', size: 100 },
      { name: '', size: 200 },
      { size: 300 },
      'invalid',
      undefined,
    ];

    vitest.expect(normalizeOllamaModels(raw)).toEqual([{ name: 'mistral:latest', size: 100 }]);
  });
});

vitest.describe('ollamaModelToDescriptor', () => {
  vitest.it('returns a suggestion model descriptor with Ollama metadata', () => {
    const record = { name: 'mistral:latest', size: 100 };
    vitest.expect(ollamaModelToDescriptor(record)).toEqual({
      id: 'mistral:latest',
      label: 'mistral:latest',
      tier: 'included',
      provider: 'ollama',
      completionSource: 'ollama',
    });
  });
});
