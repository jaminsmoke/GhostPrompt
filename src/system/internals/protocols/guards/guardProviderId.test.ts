/**
 * @file Pruebas del predicado `isProviderId`.
 */

import * as vitest from 'vitest';

import { isProviderId } from './guardProviderId';

vitest.describe('isProviderId', () => {
  vitest.it.each(['copilot', 'opencode', 'ollama'] as const)('acepta %s', (id) => {
    vitest.expect(isProviderId(id)).toBe(true);
  });

  vitest.it('rechaza valores desconocidos', () => {
    vitest.expect(isProviderId('multi')).toBe(false);
    vitest.expect(isProviderId()).toBe(false);
    vitest.expect(isProviderId(1)).toBe(false);
  });
});
