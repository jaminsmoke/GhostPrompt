/**
 * @file Tests de registros de error de proveedor LM.
 */
import { describe, expect, it } from 'vitest';

import { createProviderErrorRecord } from './createProviderErrorRecord';

describe('createProviderErrorRecord', () => {
  it('devuelve status error con texto localizado', () => {
    const record = createProviderErrorRecord({
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
