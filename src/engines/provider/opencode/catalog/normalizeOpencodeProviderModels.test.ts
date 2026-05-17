/**
 * @file Pruebas de normalización de proveedores OpenCode.
 */
import * as vitest from 'vitest';

import { normalizeOpencodeProviderModels } from './normalizeOpencodeProviderModels';

vitest.describe('normalizeOpencodeProviderModels', () => {
  vitest.it('normalizes object map and array forms equivalently', () => {
    const map = {
      a: { id: 'm1', name: 'One', pricing: '0x' },
      b: { id: 'm2', name: 'Two' },
    };
    const arr = [
      { id: 'm1', name: 'One', pricing: '0x' },
      { id: 'm2', name: 'Two' },
    ];
    vitest.expect(normalizeOpencodeProviderModels(map)).toEqual(normalizeOpencodeProviderModels(arr));
  });

  vitest.it('drops entries without string id', () => {
    vitest.expect(
      normalizeOpencodeProviderModels([
        { id: 'ok', name: 'OK' },
        { name: 'bad' },
        undefined,
      ] as unknown[]),
    ).toHaveLength(1);
  });
});
