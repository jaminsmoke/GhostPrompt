/**
 * @file Tests de niveles de log y conversión de severidad.
 */
import * as vitest from 'vitest';

import { levelIndex, parseLogLevelString, shouldEmit } from './levels';

vitest.describe('levels', () => {
  vitest.it('parseLogLevelString normaliza entradas', () => {
    vitest.expect(parseLogLevelString('INFO')).toBe('INFO');
    vitest.expect(parseLogLevelString('warn')).toBe('WARN');
    vitest.expect(parseLogLevelString()).toBe('INFO');
  });

  vitest.it('shouldEmit respeta umbral INFO', () => {
    vitest.expect(shouldEmit('ERROR', 'INFO')).toBe(true);
    vitest.expect(shouldEmit('INFO', 'INFO')).toBe(true);
    vitest.expect(shouldEmit('DEBUG', 'INFO')).toBe(false);
  });

  vitest.it('levelIndex es monótono', () => {
    vitest.expect(levelIndex('ERROR')).toBeLessThan(levelIndex('DEBUG'));
  });
});
