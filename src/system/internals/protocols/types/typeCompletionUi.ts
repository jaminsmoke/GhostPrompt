/**
 * @file Modo de UI del selector de motor de completado (una fuente vs multi-fuente).
 */

import type { COMPLETION_UI_KIND_VALUES } from '../constants/consCompletionUi';

export type CompletionUiKind = (typeof COMPLETION_UI_KIND_VALUES)[number];
