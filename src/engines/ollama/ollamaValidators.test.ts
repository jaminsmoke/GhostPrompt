/**
 * @file Pruebas de validadores Ollama.
 */
import { describe, expect, it } from 'vitest';

import {
  ollamaGenerateResponseChunkSchema,
  ollamaGenerateResponseSchema,
  ollamaModelSchema,
  ollamaTagsResponseSchema,
} from './ollamaValidators';

describe('ollamaValidators', () => {
  it('validates a full Ollama model record', () => {
    const parsed = ollamaModelSchema.parse({
      name: 'mistral:latest',
      ['modified_at']: '2025-01-01',
      size: 100,
      digest: 'abc',
      details: {
        format: 'onnx',
        family: 'mistral',
        families: ['mistral'],
        ['parameter_size']: '8B',
        ['quantization_level']: 'q4_0',
      },
    });

    expect(parsed.name).toBe('mistral:latest');
    expect(parsed.details?.format).toBe('onnx');
  });

  it('rejects an invalid Ollama model record', () => {
    expect(() => ollamaModelSchema.parse({ name: '', ['modified_at']: '2025-01-01' })).toThrow();
  });

  it('accepts tags response with optional models array', () => {
    const parsed = ollamaTagsResponseSchema.parse({ models: [{ name: 'mistral:latest' }] });
    expect(parsed.models).toHaveLength(1);
  });

  it('accepts generate response with optional fields', () => {
    const parsed = ollamaGenerateResponseSchema.parse({ model: 'mistral:latest', done: true });
    expect(parsed.model).toBe('mistral:latest');
    expect(parsed.done).toBe(true);
  });

  it('accepts streaming chunk objects with passthrough data', () => {
    const parsed = ollamaGenerateResponseChunkSchema.parse({ response: 'hello', extra: 'ignored' });
    expect(parsed.response).toBe('hello');
    expect((parsed as unknown as { extra: string }).extra).toBe('ignored');
  });
});
