import { describe, expect, it } from 'vitest';

import { normalizeOllamaModels, ollamaModelToDescriptor } from './normalizeOllamaModels';

describe('normalizeOllamaModels', () => {
  it('returns an empty array for null or undefined input', () => {
    expect(normalizeOllamaModels(null)).toEqual([]);
    expect(normalizeOllamaModels(undefined)).toEqual([]);
  });

  it('returns an empty array when the input is not an array', () => {
    expect(normalizeOllamaModels({})).toEqual([]);
    expect(normalizeOllamaModels('not an array')).toEqual([]);
  });

  it('filters out invalid Ollama model records', () => {
    const raw = [
      { name: 'mistral:latest', size: 100 },
      { name: '', size: 200 },
      { size: 300 },
      'invalid',
      null,
    ];

    expect(normalizeOllamaModels(raw)).toEqual([{ name: 'mistral:latest', size: 100 }]);
  });
});

describe('ollamaModelToDescriptor', () => {
  it('returns a suggestion model descriptor with Ollama metadata', () => {
    const record = { name: 'mistral:latest', size: 100 };
    expect(ollamaModelToDescriptor(record)).toEqual({
      id: 'mistral:latest',
      label: 'mistral:latest',
      tier: 'included',
      provider: 'ollama',
      completionSource: 'ollama',
    });
  });
});
