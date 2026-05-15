/**
 * @file Último modelo efectivo usado en una suggestion exitosa (payload settings).
 */
import type { SuggestionModelDescriptor } from '../internals/protocols/types';

let _lastEffectiveModel: SuggestionModelDescriptor | undefined;

/**
 * Devuelve el último modelo con el que se generó una suggestion exitosa.
 * @returns {SuggestionModelDescriptor | undefined} Descriptor del modelo o undefined.
 */
export function getLastEffectiveSuggestionModel(): SuggestionModelDescriptor | undefined {
  return _lastEffectiveModel;
}

/**
 * Registra el modelo devuelto por una suggestion exitosa.
 * @param {SuggestionModelDescriptor | undefined} model Descriptor del modelo usado.
 */
export function setLastEffectiveSuggestionModel(model: SuggestionModelDescriptor | undefined): void {
  _lastEffectiveModel = model;
}

/**
 * Reinicia el modelo efectivo (tests).
 */
export function resetLastEffectiveSuggestionModel(): void {
  _lastEffectiveModel = undefined;
}
