/**
 * @file Barrel público del sistema de logging estructurado.
 */
export type { Breadcrumb, LogEntry, LogTransport } from './types';
export type { LogLevelName } from './levels';
export { LOG_LEVEL_ORDER, levelIndex, parseLogLevelString, shouldEmit } from './levels';
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
