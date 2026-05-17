/**
 * @file Pruebas de acotado de texto de suggestion.
 */

import * as vitest from 'vitest';

import { boundSuggestionText } from './guardBoundSuggestion';

vitest.describe('boundSuggestionText', () => {
  vitest.it('recorta al máximo sin modificar bordes', () => {
    vitest.expect(boundSuggestionText('hello world', 5)).toBe('hello');
    vitest.expect(boundSuggestionText('  spaced  ', 20)).toBe('  spaced  ');
  });

  vitest.it('devuelve vacío si maxChars es 0', () => {
    vitest.expect(boundSuggestionText('text', 0)).toBe('');
  });
});
