/**
 * @file Pruebas de construcción de instrucción LM para completado.
 */

import * as vitest from 'vitest';

import { buildCompletionInstruction } from './buildCompletionInstruction';

vitest.describe('buildCompletionInstruction', () => {
  vitest.it('genera instruccion simple', () => {
    const instruction = buildCompletionInstruction('Escribe una propuesta');

    vitest.expect(instruction).toContain('Complete the following text as a natural continuation');
    vitest.expect(instruction).toContain('Only output the continuation itself');
    vitest.expect(instruction).toContain('Escribe una propuesta');
    vitest.expect(instruction).not.toContain('STYLE_');
    vitest.expect(instruction).not.toContain('Partial text to continue');
  });

  vitest.it('no repite contexto ignorado', () => {
    const instruction = buildCompletionInstruction('Create a test plan');
    vitest.expect(instruction).toContain('Create a test plan');
  });
});
