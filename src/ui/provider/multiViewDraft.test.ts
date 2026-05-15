/**
 * @file Tests del borrador compartido multi-vista.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getMultiViewDraftText,
  resetMultiViewDraftText,
  setMultiViewDraftText,
} from './multiViewDraft';

describe('multiViewDraft', () => {
  beforeEach(() => {
    resetMultiViewDraftText();
  });

  it('get devuelve cadena vacía tras reset', () => {
    expect(getMultiViewDraftText()).toBe('');
  });

  it('set persiste el texto hasta el siguiente reset', () => {
    setMultiViewDraftText('hola');
    expect(getMultiViewDraftText()).toBe('hola');
    resetMultiViewDraftText();
    expect(getMultiViewDraftText()).toBe('');
  });
});
