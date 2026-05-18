/**
 * @file Tests de post-procesado del resultado LM (`finalizeEngineCompletionResult`).
 */

import * as vitest from 'vitest';

import { DEFAULT_MAX_SUGGESTION_CHARS } from '../internals/protocols/constants/consPipelineDefaults';

import { finalizeEngineCompletionResult } from './finalizeEngineCompletionResult';

const TEST_TRIM_MAX_CHARS = 5;
const TEST_PRESERVE_MODEL_MAX_CHARS = 10;

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

  vitest.it('convierte rechazo típico del LM en content-blocked', () => {
    vitest.expect(
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: "I'm sorry, I can't assist with that." },
        DEFAULT_MAX_SUGGESTION_CHARS,
      ),
    ).toEqual({ kind: 'empty', reason: 'content-blocked' });
  });

  vitest.it('recorta la sugerencia al máximo configurado', () => {
    vitest.expect(
      finalizeEngineCompletionResult({ kind: 'suggestion', suggestion: 'hello world' }, TEST_TRIM_MAX_CHARS),
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
      finalizeEngineCompletionResult(
        { kind: 'suggestion', suggestion: 'ok', model },
        TEST_PRESERVE_MODEL_MAX_CHARS,
      ),
    ).toEqual({ kind: 'suggestion', suggestion: 'ok', model });
  });
});
