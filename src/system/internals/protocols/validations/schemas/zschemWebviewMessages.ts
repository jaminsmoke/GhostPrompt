/**
 * @file Esquemas Zod host ↔ webview (postMessage). Solo `zod` — sin parsers, logging ni dependencias de VS Code.
 * Consumidos por `api/boundary/webviewProtocols.ts`.
 */
import { z } from 'zod';

import {
  COMPLETION_UI_KIND_VALUES,
  COMPLETION_UI_SOURCE_VALUES,
} from '../../constants/consCompletionUi';
import {
  MAX_MAX_SUGGESTION_CHARS,
  MAX_SUGGESTION_DEBOUNCE_MS,
  MIN_MAX_SUGGESTION_CHARS,
  MIN_SUGGESTION_DEBOUNCE_MS,
} from '../../constants/consPipelineDefaults';

const completionUiSourceSchema = z.enum(COMPLETION_UI_SOURCE_VALUES);

export const suggestionModelDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  tier: z.enum(['included', 'premium', 'unknown']),
  pricing: z.string().optional(),
  provider: z.string().optional(),
  completionSource: completionUiSourceSchema.optional(),
});

/** Payload `settings` dentro de `{ type: "settings", settings }` (host → webview). */
export const webviewSettingsPayloadSchema = z.object({
  completionProvider: completionUiSourceSchema,
  completionUiKind: z.enum(COMPLETION_UI_KIND_VALUES),
  enabledCompletionSources: z.array(completionUiSourceSchema),
  suggestionModelPolicy: z.enum(['nonPremiumOnly', 'anyModel']),
  selectedModelId: z.string(),
  availableModels: z.array(suggestionModelDescriptorSchema),
  maxSuggestionChars: z.number().min(MIN_MAX_SUGGESTION_CHARS).max(MAX_MAX_SUGGESTION_CHARS),
  effectiveModel: suggestionModelDescriptorSchema.optional(),
  debugSuggestions: z.boolean(),
  /** Tiempo de inactividad tras teclear antes de pedir suggestion (webview debounce). */
  suggestionDebounceMs: z.number().min(MIN_SUGGESTION_DEBOUNCE_MS).max(MAX_SUGGESTION_DEBOUNCE_MS),
  /** Destino del agente: Copilot Chat, VSOpenCodeX o Cursor Chat (v0.6). */
  agentDestination: z.enum(['copilotChat', 'vsOpenCodeX', 'cursorChat']),
  /** Si la extensión VSOpenCodeX está instalada (control destino en webview). */
  vsOpenCodeXExtensionInstalled: z.boolean(),
  /** Si el host es Cursor Desktop (`vscode.env.appName`); UI puede ocultar `cursorChat` si es false. */
  cursorDesktopHost: z.boolean(),
});

export const webviewOutboundSettingsEnvelopeSchema = z.object({
  type: z.literal('settings'),
  settings: webviewSettingsPayloadSchema,
});

export const providerStateRecordSchema = z.object({
  id: completionUiSourceSchema,
  status: z.enum(['running', 'stopped', 'starting', 'unavailable', 'error']),
  label: z.string(),
  statusText: z.string().optional(),
  actions: z.array(z.enum(['start', 'stop'])).optional(),
});

export const webviewOutboundProviderStatusSchema = z.object({
  type: z.literal('providerStatus'),
  providers: z.array(providerStateRecordSchema),
});

export const webviewOutboundLoadingSchema = z.object({
  type: z.literal('loading'),
  captureId: z.number(),
  phase: z.string().optional(),
  statusText: z.string().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundSuggestionSchema = z.object({
  type: z.literal('suggestion'),
  suggestion: z.string(),
  captureId: z.number(),
  model: suggestionModelDescriptorSchema.optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundSuggestionStreamSchema = z.object({
  type: z.literal('suggestion-stream'),
  text: z.string(),
  captureId: z.number(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundEmptySchema = z.object({
  type: z.literal('empty'),
  reason: z.enum([
    'no-model',
    'no-included-model',
    'premium-quota-blocked',
    'empty-response',
    'request-timeout',
    'too-short',
    'duplicate-input',
    'rate-limited',
    'session-budget-exhausted',
    'content-blocked',
  ]),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundClearSchema = z.object({
  type: z.literal('clear'),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

export const webviewOutboundDraftHydrateSchema = z.object({
  type: z.literal('draftHydrate'),
  text: z.string(),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});

/** Union discriminada de todos los mensajes host → webview. */
export const webviewOutboundMessageSchema = z.discriminatedUnion('type', [
  webviewOutboundSettingsEnvelopeSchema,
  webviewOutboundProviderStatusSchema,
  webviewOutboundLoadingSchema,
  webviewOutboundSuggestionSchema,
  webviewOutboundSuggestionStreamSchema,
  webviewOutboundEmptySchema,
  webviewOutboundErrorSchema,
  webviewOutboundClearSchema,
  webviewOutboundDraftHydrateSchema,
]);

export type WebviewOutboundMessage = z.infer<typeof webviewOutboundMessageSchema>;

export type WebviewSettingsPayload = z.infer<typeof webviewSettingsPayloadSchema>;

export const webviewUpdateSettingSchema = z.discriminatedUnion('key', [
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('suggestionModelPolicy'),
    value: z.enum(['nonPremiumOnly', 'anyModel']),
  }),
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('selectedModelId'),
    value: z.string(),
  }),
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('maxSuggestionChars'),
    value: z.number().min(MIN_MAX_SUGGESTION_CHARS).max(MAX_MAX_SUGGESTION_CHARS),
  }),
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('debugSuggestions'),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('completionProvider'),
    value: completionUiSourceSchema,
  }),
  z.object({
    type: z.literal('updateSetting'),
    key: z.literal('agentDestination'),
    value: z.enum(['copilotChat', 'vsOpenCodeX', 'cursorChat']),
  }),
]);

export const webviewInboundLogSchema = z.object({
  type: z.literal('log'),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  captureId: z.number().optional(),
});

/** Mensajes recibidos desde el webview (webview → host); mismo contrato que salida del cliente. */
export const webviewInboundMessageSchema = z.union([
  z.object({ type: z.literal('init') }),
  z.object({
    type: z.literal('suggest'),
    text: z.string(),
    captureId: z.number(),
  }),
  z.object({
    type: z.literal('draftChanged'),
    text: z.string(),
    originViewId: z.string().min(1),
  }),
  z.object({
    type: z.literal('accept'),
    context: z.string(),
    suggestion: z.string(),
  }),
  z.object({
    type: z.literal('send'),
    text: z.string(),
  }),
  webviewInboundLogSchema,
  webviewUpdateSettingSchema,
  z.object({ type: z.literal('requestProviderStatus') }),
  z.object({ type: z.literal('startProvider'), provider: z.string() }),
  z.object({ type: z.literal('stopProvider'), provider: z.string() }),
]);

export type WebviewInboundMessage = z.infer<typeof webviewInboundMessageSchema>;

export type WebviewUpdateSetting = z.infer<typeof webviewUpdateSettingSchema>;
