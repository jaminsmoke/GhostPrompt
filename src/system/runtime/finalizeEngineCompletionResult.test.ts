/**
 * @file Tests de post-procesado del resultado LM (`finalizeEngineCompletionResult`).
 */

import * as vitest from 'vitest';

import { finalizeEngineCompletionResult } from './finalizeEngineCompletionResult';

vitest.describe('finalizeEngineCompletionResult', () => {
  vitest.it('no altera empty ni error', () => {
    vitest.expect(finalizeEngineCompletionResult({ kind: 'empty', reason: 'no-model' }, 180)).toEqual({
      kind: 'empty',
      reason: 'no-model',
    });
    vitest.expect(finalizeEngineCompletionResult({ kind: 'error', message: 'x' }, 180)).toEqual({
      kind: 'error',
      message: 'x',
    });
  });

  vitest.it('convierte rechazo típico del LM en content-blocked', () => {
    vitest.expect(
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: "I'm sorry, I can't assist with that." },
        180,
      ),
    ).toEqual({ kind: 'empty', reason: 'content-blocked' });
  });

  vitest.it('recorta la sugerencia al máximo configurado', () => {
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'hello world' }, 5),
    ).toEqual({ kind: 'suggestion', suggestion: 'hello' });
  });

  vitest.it('vacío tras acotación emite empty-response', () => {
    vitest.expect(finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'text' }, 0)).toEqual({
      kind: 'empty',
      reason: 'empty-response',
    });
  });

  vitest.it('preserva metadata del modelo en suggestion', () => {
    const model = { id: 'm', label: 'M', tier: 'included' as const };
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'ok', model }, 10),
    ).toEqual({ kind: 'suggestion', suggestion: 'ok', model });
  });
});
