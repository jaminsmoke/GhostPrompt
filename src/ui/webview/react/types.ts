/**
 * @file Tipos compartidos del webview React GhostPrompt.
 * Tipos de protocolo importados desde `system/internals/protocols/`.
 */

// ── Webview-specific ──────────────────────────────────────────

export type GhostPromptCapabilities = {
  compactToolbar?: boolean;
};

declare global {
  /** Inyectado en el bundle del webview (`webviewHtml.ts`). */
  var __ghostPromptViewId: string | undefined;
  /** Inyectado en el bundle del webview (`webviewHtml.ts`). */
  var __ghostPromptCapabilities: GhostPromptCapabilities | undefined;

  interface Window {
    __ghostPromptViewId?: string;
    __ghostPromptCapabilities?: GhostPromptCapabilities;
  }
}

export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

// ── Desde protocols/state/provider ────────────────────────────

import type {
  ProviderState,
  ProviderStateRecord,
} from '../../../system/internals/protocols/state/provider';

export type CompletionSourceState = ProviderState;
export type CompletionSourceStateRecord = ProviderStateRecord;

export type { ProviderId as CompletionProvider } from '../../../system/internals/protocols/state/provider';

// ── Desde protocols/types ─────────────────────────────────────

export type { SuggestionModelDescriptor as SuggestionModel } from '../../../system/internals/protocols/types';

export type { DestinationId as AgentDestination } from '../../../system/internals/protocols/types/typeDestinations';

// ── Desde protocols/validations/schemas ───────────────────────

export type {
  WebviewOutboundMessage as InboundMessage,
  WebviewInboundMessage as OutboundMessage,
  WebviewSettingsPayload as SettingsPayload,
  WebviewUpdateSetting as UpdateSettingMessage,
} from '../../../system/internals/protocols/validations/schemas';
