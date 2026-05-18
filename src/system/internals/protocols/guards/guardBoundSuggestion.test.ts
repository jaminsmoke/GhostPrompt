/**
 * @file Pruebas de acotado de texto de suggestion.
 */

import * as vitest from 'vitest';

import { boundSuggestionText } from './guardBoundSuggestion';

const TEST_BOUND_MAX_SHORT = 5;
const TEST_BOUND_MAX_WIDE = 20;

vitest.describe('boundSuggestionText', () => {
  vitest.it('recorta al máximo sin modificar bordes', () => {
    vitest.expect(boundSuggestionText('hello world', TEST_BOUND_MAX_SHORT)).toBe('hello');
    vitest.expect(boundSuggestionText('  spaced  ', TEST_BOUND_MAX_WIDE)).toBe('  spaced  ');
  });

  vitest.it('devuelve vacío si maxChars es 0', () => {
    vitest.expect(boundSuggestionText('text', 0)).toBe('');
  });
});
