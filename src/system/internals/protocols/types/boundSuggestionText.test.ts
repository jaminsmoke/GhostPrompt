/**
 * @file Pruebas de acotado de texto de suggestion.
 */
import { describe, expect, it } from 'vitest';

import { boundSuggestionText } from './boundSuggestionText';

describe('boundSuggestionText', () => {
  it('recorta al máximo sin modificar bordes', () => {
    expect(boundSuggestionText('hello world', 5)).toBe('hello');
    expect(boundSuggestionText('  spaced  ', 20)).toBe('  spaced  ');
  });

  it('devuelve vacío si maxChars es 0', () => {
    expect(boundSuggestionText('text', 0)).toBe('');
  });
});
