/**
 * @file Pruebas de heurísticas Copilot LM (`guards/copilotLm`).
 */
import { describe, expect, it } from 'vitest';

import { isPremiumQuotaCopilotError, looksLikeCopilotRefusal } from './copilotLm';

describe('isPremiumQuotaCopilotError', () => {
  it('detecta mensajes típicos de cuota premium', () => {
    expect(isPremiumQuotaCopilotError('Premium model quota exceeded')).toBe(true);
    expect(isPremiumQuotaCopilotError('additional paid premium requests')).toBe(true);
    expect(isPremiumQuotaCopilotError('Wait for allowance to renew')).toBe(true);
  });

  it('no marca errores genéricos', () => {
    expect(isPremiumQuotaCopilotError('Network failure')).toBe(false);
    expect(isPremiumQuotaCopilotError('')).toBe(false);
  });
});

describe('looksLikeCopilotRefusal', () => {
  it('detecta negativas habituales', () => {
    expect(looksLikeCopilotRefusal("I'm sorry, I can't assist with that.")).toBe(true);
    expect(looksLikeCopilotRefusal('cannot assist with this request')).toBe(true);
    expect(looksLikeCopilotRefusal('unable to help')).toBe(true);
  });

  it('no marca texto vacío ni continuaciones normales', () => {
    expect(looksLikeCopilotRefusal('')).toBe(false);
    expect(looksLikeCopilotRefusal('   ')).toBe(false);
    expect(looksLikeCopilotRefusal('Here is the next paragraph.')).toBe(false);
  });
});
