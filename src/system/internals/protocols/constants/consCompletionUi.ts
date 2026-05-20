/**
 * @file Modo de UI del selector de motor de completado (una fuente vs multi-fuente).
 */

import { PROVIDER_ID_VALUES, type ProviderId } from '../state/provider/stateProviderId';

/** Valores de fuente LM en settings. */
export const COMPLETION_UI_SOURCE_VALUES = PROVIDER_ID_VALUES satisfies readonly ProviderId[];

/** Valores de `completionUiKind` en el envelope `settings` (host → webview). */
export const COMPLETION_UI_KIND_VALUES = [
  ...COMPLETION_UI_SOURCE_VALUES,
  'multi',
] as const;
