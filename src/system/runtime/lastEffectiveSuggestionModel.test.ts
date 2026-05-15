/**
 * @file Tests del modelo efectivo de suggestion.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getLastEffectiveSuggestionModel,
  resetLastEffectiveSuggestionModel,
  setLastEffectiveSuggestionModel,
} from './lastEffectiveSuggestionModel';

describe('lastEffectiveSuggestionModel', () => {
  beforeEach(() => {
    resetLastEffectiveSuggestionModel();
  });

  it('persiste y devuelve el último modelo', () => {
    setLastEffectiveSuggestionModel({ id: 'm1', label: 'M1', tier: 'included' });
    expect(getLastEffectiveSuggestionModel()?.id).toBe('m1');
    resetLastEffectiveSuggestionModel();
    expect(getLastEffectiveSuggestionModel()).toBeUndefined();
  });
});
