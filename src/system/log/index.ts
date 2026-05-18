/**
 * @file Barrel público del sistema de logging estructurado.
 *
 * Tipos, constantes y guards canónicos viven en `system/internals/protocols/`.
 * Este barrel re-exporta contratos puros y la API con side effects (`Logger`, `LogManager`, …).
 */
export type {
  Breadcrumb,
  EmitPayload,
  LogEmitSink,
  LogEntry,
  LogLevel,
  LogLevelName,
  LogTransport,
} from '../internals/protocols/types/typeLog';
export {
  GHOSTPROMPT_LOG_CHANNEL_NAME,
  LOG_FILE_ROTATE_MAX_BYTES,
  LOG_LEGACY_MD_PREVIEW_MAX_CHARS,
  LOG_OUTPUT_CHANNEL_RING_SIZE,
} from '../internals/protocols/constants/consLogLimits';
export {
  LOG_LEVEL_ORDER,
  levelIndex,
  parseLogLevelString,
  shouldEmit,
} from '../internals/protocols/guards/guardLogLevel';
export { Logger } from './Logger';
export { CaptureBreadcrumbStore } from './breadcrumbs';
export {
  disposeGhostPromptLogging,
  ensureSuggestionDebugChannel,
  flushLogCapture,
  getLogger,
  initGhostPromptLogging,
  isSuggestionDebugEnabled,
  logOpenCodeDebug,
  logOpenCodePerfCapture,
  resolveEffectiveMinLevelName,
  toggleSuggestionDebug,
} from './LogManager';
export {
  appendGhostPromptOutputLine,
  disposeGhostPromptOutputChannel,
  getGhostPromptOutputChannel,
} from './transports/outputChannel';
export {
  formatHostFaultMessage,
  reportHostFault,
  revealGhostPromptLogChannel,
  writeGhostPromptLogBootstrap,
} from './hostFault';
