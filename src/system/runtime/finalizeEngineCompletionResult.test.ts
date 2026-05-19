/**
 * @file Tests de post-procesado del resultado LM (`finalizeEngineCompletionResult`).
 */

import * as vitest from 'vitest';

import { DEFAULT_MAX_SUGGESTION_CHARS } from '../internals/protocols/constants/consPipelineDefaults';

import { finalizeEngineCompletionResult } from './finalizeEngineCompletionResult';

const IGNORED_MAX_CHARS = 5;

vitest.describe('finalizeEngineCompletionResult', () => {
  vitest.it('no altera empty ni error', () => {
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'empty', reason: 'no-model' }, DEFAULT_MAX_SUGGESTION_CHARS),
    ).toEqual({
      kind: 'empty',
      reason: 'no-model',
    });
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'error', message: 'x' }, DEFAULT_MAX_SUGGESTION_CHARS),
    ).toEqual({
      kind: 'error',
      message: 'x',
    });
  });

  vitest.it('passthrough: no filtra rechazos ni recorta (modo diagnóstico v0.6.2)', () => {
    const refusal = "I'm sorry, I can't assist with that.";
    vitest.expect(
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: refusal },
        DEFAULT_MAX_SUGGESTION_CHARS,
      ),
    ).toEqual({ kind: 'suggestion', suggestion: refusal });

    const long = 'abcdefghijklmnopqrstuvwxyz';
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: long }, IGNORED_MAX_CHARS),
    ).toEqual({ kind: 'suggestion', suggestion: long });
  });

  vitest.it('vacío explícito emite empty-response', () => {
    vitest.expect(finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: '' }, 0)).toEqual({
      kind: 'empty',
      reason: 'empty-response',
    });
  });

  vitest.it('preserva metadata del modelo en suggestion', () => {
    const model = { id: 'm', label: 'M', tier: 'included' as const };
    vitest.expect(
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: 'ok', model },
        DEFAULT_MAX_SUGGESTION_CHARS,
      ),
    ).toEqual({ kind: 'suggestion', suggestion: 'ok', model });
  });
});
