/**
 * @file Contratos de estado de fuentes de completado (copilot, opencode, ollama).
 */
import type { CompletionSourceId } from '../completionSourceId';

export type CompletionSourceState =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'unavailable'
  | 'error';

export interface CompletionSourceStateRecord {
  id: CompletionSourceId;
  status: CompletionSourceState;
  label: string;
  statusText?: string;
  actions?: ('start' | 'stop')[];
}

export interface CompletionSourceStatusModule {
  id: CompletionSourceId;
  label: string;
  check(): Promise<CompletionSourceStateRecord>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}
