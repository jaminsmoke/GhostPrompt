/**
 * @file Presets y bandas de longitud de pre-suggestion (slider + atajos).
 */
/* eslint-disable no-magic-numbers -- constantes de producto acordadas en plan FQ */
import { MAX_MAX_SUGGESTION_CHARS } from './consPipelineDefaults';

/** Presets equidistantes: muy conciso → muy extenso (normal en el centro del varado). */
export const SUGGESTION_LENGTH_PRESETS = [40, 155, 270, 385, 500] as const;

export type SuggestionLengthPreset = (typeof SUGGESTION_LENGTH_PRESETS)[number];

/** Etiquetas de producto para presets y bandas del slider. */
export const SUGGESTION_LENGTH_LABELS = [
  'Muy conciso',
  'Conciso',
  'Normal',
  'Extenso',
  'Muy extenso',
] as const;

export type SuggestionLengthLabel = (typeof SUGGESTION_LENGTH_LABELS)[number];

/** Límites superiores inclusivos de cada banda (índice = etiqueta). */
export const SUGGESTION_LENGTH_BAND_MAX_CHARS = [97, 212, 327, 442, MAX_MAX_SUGGESTION_CHARS] as const;

export { MIN_MAX_SUGGESTION_CHARS, MAX_MAX_SUGGESTION_CHARS } from './consPipelineDefaults';
