import { describe, expect, it } from 'vitest';

import { buildCompletionInstruction } from '../src/core/instruction';
import { normalizeSuggestion } from '../src/core/normalize';

/**
 * Contrato Fase 1 v0.5: la instrucción pide comportamiento; normalize corrige
 * desviaciones típicas del LM (no repetir prefijo).
 */
describe('instruction ↔ normalize contract', () => {
  it('la instrucción incluye anti-duplicación y guía de espacio inicial', () => {
    const instruction = buildCompletionInstruction('hello ', 'balanced');
    expect(instruction).toContain('Do not repeat the prompt text before the partial text.');
    expect(instruction).toContain('leading space');
    expect(instruction).toContain('Partial text to continue:');
  });

  it('normalize elimina eco del prefijo cuando el LM ignora Never repeat', () => {
    expect(normalizeSuggestion('hello world next bit', 'hello world ', 100)).toBe('next bit');
  });

  it('quita espacio inicial erróneo en continuación mid-word (p. ej. commit)', () => {
    expect(normalizeSuggestion(' itmentes más frecuentes', 'podriamos hacer comm', 200)).toBe(
      'itmentes más frecuentes',
    );
  });

  it('normalize no intenta corregir solape parcial (modelo debe obedecer prompt)', () => {
    const result = normalizeSuggestion(
      'de autenticación con refresh token',
      'Diseña un flujo de autenticación ',
      200,
    );
    expect(result).toBe('de autenticación con refresh token');
  });

  it('maxChars solo aplica en normalize (tope duro frente a STYLE_* por palabras)', () => {
    expect(normalizeSuggestion('abcdefgh', '', 4)).toBe('abcd');
  });
});
