/**
 * @file Tests de post-procesado del resultado LM (`finalizeEngineCompletionResult`).
 */
import { describe, expect, it } from 'vitest';

import { finalizeEngineCompletionResult } from './finalizeEngineCompletionResult';

describe('finalizeEngineCompletionResult', () => {
  it('no altera empty ni error', () => {
    expect(finalizeEngineCompletionResult({ kind: 'empty', reason: 'no-model' }, 180)).toEqual({
      kind: 'empty',
      reason: 'no-model',
    });
    expect(finalizeEngineCompletionResult({ kind: 'error', message: 'x' }, 180)).toEqual({
      kind: 'error',
      message: 'x',
    });
  });

  it('convierte rechazo típico del LM en content-blocked', () => {
    expect(
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: "I'm sorry, I can't assist with that." },
        180,
      ),
    ).toEqual({ kind: 'empty', reason: 'content-blocked' });
  });

  it('recorta la sugerencia al máximo configurado', () => {
    expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'hello world' }, 5),
    ).toEqual({ kind: 'suggestion', suggestion: 'hello' });
  });

  it('vacío tras acotación emite empty-response', () => {
    expect(finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'text' }, 0)).toEqual({
      kind: 'empty',
      reason: 'empty-response',
    });
  });

  it('preserva metadata del modelo en suggestion', () => {
    const model = { id: 'm', label: 'M', tier: 'included' as const };
    expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'ok', model }, 10),
    ).toEqual({ kind: 'suggestion', suggestion: 'ok', model });
  });
});
