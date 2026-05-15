/**
 * @file Pruebas de normalización de proveedores OpenCode.
 */
import { describe, expect, it } from 'vitest';

import { normalizeOpencodeProviderModels } from './normalizeOpencodeProviderModels';

describe('normalizeOpencodeProviderModels', () => {
  it('normalizes object map and array forms equivalently', () => {
    const map = {
      a: { id: 'm1', name: 'One', pricing: '0x' },
      b: { id: 'm2', name: 'Two' },
    };
    const arr = [
      { id: 'm1', name: 'One', pricing: '0x' },
      { id: 'm2', name: 'Two' },
    ];
    expect(normalizeOpencodeProviderModels(map)).toEqual(normalizeOpencodeProviderModels(arr));
  });

  it('drops entries without string id', () => {
    expect(
      normalizeOpencodeProviderModels([
        { id: 'ok', name: 'OK' },
        { name: 'bad' },
        null,
      ] as unknown[]),
    ).toHaveLength(1);
  });
});
