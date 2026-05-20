/**
 * @file Tests de etiquetas e hints por longitud.
 */
import * as vitest from 'vitest';

import {
  MAX_MAX_SUGGESTION_CHARS,
  MIN_MAX_SUGGESTION_CHARS,
} from '../constants/consPipelineDefaults';
import {
  SUGGESTION_LENGTH_BAND_MAX_CHARS,
  SUGGESTION_LENGTH_PRESETS,
} from '../constants/consSuggestionLength';

import {
  clampMaxSuggestionChars,
  deriveSuggestionLengthLabel,
  instructionHintForMaxChars,
} from './suggestionLength';

const [PRESET_MUY_CONCISO, , PRESET_NORMAL, , PRESET_MUY_EXTENSO] = SUGGESTION_LENGTH_PRESETS;
const [
  BAND_MUY_CONCISO_MAX,
  BAND_CONCISO_MAX,
  BAND_NORMAL_MAX,
  BAND_EXTENSO_MAX,
] = SUGGESTION_LENGTH_BAND_MAX_CHARS;

vitest.describe('clampMaxSuggestionChars', () => {
  vitest.it('acota al rango de producto', () => {
    vitest.expect(clampMaxSuggestionChars(10)).toBe(MIN_MAX_SUGGESTION_CHARS);
    vitest.expect(clampMaxSuggestionChars(MAX_MAX_SUGGESTION_CHARS + 1)).toBe(
      MAX_MAX_SUGGESTION_CHARS,
    );
    vitest.expect(clampMaxSuggestionChars(PRESET_NORMAL)).toBe(PRESET_NORMAL);
  });
});

vitest.describe('deriveSuggestionLengthLabel', () => {
  vitest.it('asigna bandas en los límites acordados', () => {
    vitest.expect(deriveSuggestionLengthLabel(PRESET_MUY_CONCISO)).toBe('Muy conciso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_MUY_CONCISO_MAX)).toBe('Muy conciso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_MUY_CONCISO_MAX + 1)).toBe('Conciso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_CONCISO_MAX)).toBe('Conciso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_CONCISO_MAX + 1)).toBe('Normal');
    vitest.expect(deriveSuggestionLengthLabel(PRESET_NORMAL)).toBe('Normal');
    vitest.expect(deriveSuggestionLengthLabel(BAND_NORMAL_MAX)).toBe('Normal');
    vitest.expect(deriveSuggestionLengthLabel(BAND_NORMAL_MAX + 1)).toBe('Extenso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_EXTENSO_MAX)).toBe('Extenso');
    vitest.expect(deriveSuggestionLengthLabel(BAND_EXTENSO_MAX + 1)).toBe('Muy extenso');
    vitest.expect(deriveSuggestionLengthLabel(PRESET_MUY_EXTENSO)).toBe('Muy extenso');
  });
});

vitest.describe('instructionHintForMaxChars', () => {
  vitest.it('devuelve hints distintos en extremos', () => {
    const short = instructionHintForMaxChars(PRESET_MUY_CONCISO);
    const long = instructionHintForMaxChars(PRESET_MUY_EXTENSO);
    vitest.expect(short).toContain('extremely short');
    vitest.expect(long).toContain('at length');
    vitest.expect(short).not.toBe(long);
  });
});
