/**
 * @file Reexportación de constantes runtime de `protocols/` usadas por el bundle React.
 * Los tipos viven en `./types`; los schemas Zod en `./webviewProtocolSchemas`.
 */
export {
  DEFAULT_SUGGESTION_DEBOUNCE_MS,
  MAX_SUGGESTION_DEBOUNCE_MS,
  MIN_SUGGESTION_DEBOUNCE_MS,
  WEBVIEW_DEBUG_TEXT_PREVIEW_CHARS,
  WEBVIEW_PROVIDER_STATUS_STALE_MS,
  WEBVIEW_TEXTAREA_COMPACT_MIN_HEIGHT_PX,
  WEBVIEW_TEXTAREA_MIN_HEIGHT_PX,
} from '../../../system/internals/protocols/constants/consPipelineDefaults';

export { COMPLETION_UI_SOURCE_VALUES } from '../../../system/internals/protocols/constants/consCompletionUi';
