/**
 * @file Tests del modelo efectivo de suggestion.
 */

import * as vitest from 'vitest';

import {
  getLastEffectiveSuggestionModel,
  resetLastEffectiveSuggestionModel,
  setLastEffectiveSuggestionModel,
} from './lastEffectiveSuggestionModel';

vitest.describe('lastEffectiveSuggestionModel', () => {
  vitest.beforeEach(() => {
    resetLastEffectiveSuggestionModel();
  });

  vitest.it('persiste y devuelve el último modelo', () => {
    setLastEffectiveSuggestionModel({ id: 'm1', label: 'M1', tier: 'included' });
    vitest.expect(getLastEffectiveSuggestionModel()?.id).toBe('m1');
    resetLastEffectiveSuggestionModel();
    vitest.expect(getLastEffectiveSuggestionModel()).toBeUndefined();
  });
});
