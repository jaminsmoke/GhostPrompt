/**
 * @file Pruebas de heurística de id OpenCode para enrutado.
 */

import * as vitest from 'vitest';

import { looksLikeOpencodeModelId } from './routingModelId';

vitest.describe('looksLikeOpencodeModelId', () => {
  vitest.it('detecta formato provider/model', () => {
    vitest.expect(looksLikeOpencodeModelId('foo/bar')).toBe(true);
    vitest.expect(looksLikeOpencodeModelId('gpt-4o-mini')).toBe(false);
  });
});
