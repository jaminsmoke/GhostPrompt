/**
 * @file Tests de registros de error de proveedor LM.
 */

import * as vitest from 'vitest';

import { createProviderErrorRecord } from './createProviderErrorRecord';

vitest.describe('createProviderErrorRecord', () => {
  vitest.it('devuelve status error con texto localizado', () => {
    const record = createProviderErrorRecord({
      id: 'ollama',
      label: 'Ollama',
    });

    vitest.expect(record).toEqual({
      id: 'ollama',
      status: 'error',
      label: 'Ollama',
      statusText: 'Error al comprobar estado',
    });
  });
});
