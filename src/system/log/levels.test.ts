/**
 * @file Tests de niveles de log y conversión de severidad.
 */
import { describe, expect, it } from 'vitest';

import { levelIndex, parseLogLevelString, shouldEmit } from './levels';

describe('levels', () => {
  it('parseLogLevelString normaliza entradas', () => {
    expect(parseLogLevelString('INFO')).toBe('INFO');
    expect(parseLogLevelString('warn')).toBe('WARN');
    expect(parseLogLevelString(undefined)).toBe('INFO');
  });

  it('shouldEmit respeta umbral INFO', () => {
    expect(shouldEmit('ERROR', 'INFO')).toBe(true);
    expect(shouldEmit('INFO', 'INFO')).toBe(true);
    expect(shouldEmit('DEBUG', 'INFO')).toBe(false);
  });

  it('levelIndex es monótono', () => {
    expect(levelIndex('ERROR')).toBeLessThan(levelIndex('DEBUG'));
  });
});
