/**
 * @file Tests de registros de error de fuente de completado.
 */
import { describe, expect, it } from 'vitest';

import { createCompletionSourceErrorRecord } from './createCompletionSourceErrorRecord';

describe('createCompletionSourceErrorRecord', () => {
  it('devuelve status error con texto localizado', () => {
    const record = createCompletionSourceErrorRecord({
      id: 'ollama',
      label: 'Ollama',
    });

    expect(record).toEqual({
      id: 'ollama',
      status: 'error',
      label: 'Ollama',
      statusText: 'Error al comprobar estado',
    });
  });
});
