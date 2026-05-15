/**
 * @file Pruebas de formato de ID de modelo OpenCode.
 */
import { describe, expect, it } from 'vitest';

import { looksLikeOpencodeModelId } from './modelId';

describe('looksLikeOpencodeModelId', () => {
  it('detecta formato provider/model', () => {
    expect(looksLikeOpencodeModelId('foo/bar')).toBe(true);
    expect(looksLikeOpencodeModelId('gpt-4o-mini')).toBe(false);
  });
});
