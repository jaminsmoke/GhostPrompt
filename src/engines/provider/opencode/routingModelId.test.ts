/**
 * @file Pruebas de heurística de id OpenCode para enrutado.
 */
import { describe, expect, it } from 'vitest';

import { looksLikeOpencodeModelId } from './routingModelId';

describe('looksLikeOpencodeModelId', () => {
  it('detecta formato provider/model', () => {
    expect(looksLikeOpencodeModelId('foo/bar')).toBe(true);
    expect(looksLikeOpencodeModelId('gpt-4o-mini')).toBe(false);
  });
});
