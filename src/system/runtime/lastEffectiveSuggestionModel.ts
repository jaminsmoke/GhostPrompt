/**
 * @file Último modelo efectivo usado en una suggestion exitosa (payload settings).
 */
import { clearOptionalProperty, isDefined } from '../internals/isDefined';

import type { SuggestionModelDescriptor } from '../internals/protocols/types';

const lastEffectiveModelSlot: { current?: SuggestionModelDescriptor } = {};

/**
 * Devuelve el último modelo con el que se generó una suggestion exitosa.
 * @returns {SuggestionModelDescriptor | undefined} Descriptor del modelo o undefined.
 */
export function getLastEffectiveSuggestionModel(): SuggestionModelDescriptor | undefined {
  return lastEffectiveModelSlot.current;
}

/**
 * Registra el modelo devuelto por una suggestion exitosa.
 * @param {SuggestionModelDescriptor | undefined} model - Descriptor del modelo usado.
 */
export function setLastEffectiveSuggestionModel(model: SuggestionModelDescriptor | undefined): void {
  if (!isDefined(model)) {
    clearOptionalProperty(lastEffectiveModelSlot, 'current');
    return;
  }
  lastEffectiveModelSlot.current = model;
}

/**
 * Reinicia el modelo efectivo (tests).
 */
export function resetLastEffectiveSuggestionModel(): void {
  clearOptionalProperty(lastEffectiveModelSlot, 'current');
}
