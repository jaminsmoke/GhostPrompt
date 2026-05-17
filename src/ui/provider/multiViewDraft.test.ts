/**
 * @file Tests del borrador compartido multi-vista.
 */

import * as vitest from 'vitest';

import {
  getMultiViewDraftText,
  resetMultiViewDraftText,
  setMultiViewDraftText,
} from './multiViewDraft';

vitest.describe('multiViewDraft', () => {
  vitest.beforeEach(() => {
    resetMultiViewDraftText();
  });

  vitest.it('get devuelve cadena vacía tras reset', () => {
    vitest.expect(getMultiViewDraftText()).toBe('');
  });

  vitest.it('set persiste el texto hasta el siguiente reset', () => {
    setMultiViewDraftText('hola');
    vitest.expect(getMultiViewDraftText()).toBe('hola');
    resetMultiViewDraftText();
    vitest.expect(getMultiViewDraftText()).toBe('');
  });
});
