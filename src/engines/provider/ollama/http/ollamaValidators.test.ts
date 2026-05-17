/**
 * @file Pruebas de validadores Ollama.
 */
import * as vitest from 'vitest';

import {
  ollamaGenerateResponseChunkSchema,
  ollamaGenerateResponseSchema,
  ollamaModelSchema,
  ollamaTagsResponseSchema,
} from './ollamaValidators';

vitest.describe('ollamaValidators', () => {
  vitest.it('validates a full Ollama model record', () => {
    const parsed = ollamaModelSchema.parse({
      name: 'mistral:latest',
      'modified_at': '2025-01-01',
      size: 100,
      digest: 'abc',
      details: {
        format: 'onnx',
        family: 'mistral',
        families: ['mistral'],
        'parameter_size': '8B',
        'quantization_level': 'q4_0',
      },
    });

    vitest.expect(parsed.name).toBe('mistral:latest');
    vitest.expect(parsed.details?.format).toBe('onnx');
  });

  vitest.it('rejects an invalid Ollama model record', () => {
    vitest.expect(() => ollamaModelSchema.parse({ name: '', 'modified_at': '2025-01-01' })).toThrow();
  });

  vitest.it('accepts tags response with optional models array', () => {
    const parsed = ollamaTagsResponseSchema.parse({ models: [{ name: 'mistral:latest' }] });
    vitest.expect(parsed.models).toHaveLength(1);
  });

  vitest.it('accepts generate response with optional fields', () => {
    const parsed = ollamaGenerateResponseSchema.parse({ model: 'mistral:latest', done: true });
    vitest.expect(parsed.model).toBe('mistral:latest');
    vitest.expect(parsed.done).toBe(true);
  });

  vitest.it('accepts streaming chunk objects with passthrough data', () => {
    const parsed = ollamaGenerateResponseChunkSchema.parse({ response: 'hello', extra: 'ignored' });
    vitest.expect(parsed.response).toBe('hello');
    vitest.expect((parsed as unknown as { extra: string }).extra).toBe('ignored');
  });
});
