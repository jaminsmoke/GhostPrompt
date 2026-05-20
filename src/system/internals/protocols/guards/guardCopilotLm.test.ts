/**
 * @file Pruebas de heurísticas Copilot LM (`guards/guardCopilotLm`).
 */

import * as vitest from 'vitest';

import { isPremiumQuotaCopilotError, looksLikeCopilotRefusal } from './guardCopilotLm';

vitest.describe('isPremiumQuotaCopilotError', () => {
  vitest.it('detecta mensajes típicos de cuota premium', () => {
    vitest.expect(isPremiumQuotaCopilotError('Premium model quota exceeded')).toBe(true);
    vitest.expect(isPremiumQuotaCopilotError('additional paid premium requests')).toBe(true);
    vitest.expect(isPremiumQuotaCopilotError('Wait for allowance to renew')).toBe(true);
  });

  vitest.it('no marca errores genéricos', () => {
    vitest.expect(isPremiumQuotaCopilotError('Network failure')).toBe(false);
    vitest.expect(isPremiumQuotaCopilotError('')).toBe(false);
  });
});

vitest.describe('looksLikeCopilotRefusal', () => {
  vitest.it('detecta negativas habituales', () => {
    vitest.expect(looksLikeCopilotRefusal("I'm sorry, I can't assist with that.")).toBe(true);
    vitest.expect(looksLikeCopilotRefusal('cannot assist with this request')).toBe(true);
    vitest.expect(looksLikeCopilotRefusal('unable to help')).toBe(true);
  });

  vitest.it('no marca texto vacío ni continuaciones normales', () => {
    vitest.expect(looksLikeCopilotRefusal('')).toBe(false);
    vitest.expect(looksLikeCopilotRefusal('   ')).toBe(false);
    vitest.expect(looksLikeCopilotRefusal('Here is the next paragraph.')).toBe(false);
  });
});
