/**
 * @file Esquemas Zod para validar mensajes inbound del webview.
 */
import { z } from 'zod';

import type { InboundMessage } from '../types';

const providerStateRecordSchema = z.object({
  id: z.enum(['copilot', 'opencode', 'ollama']),
  status: z.enum(['running', 'stopped', 'starting', 'unavailable', 'error']),
  label: z.string(),
  statusText: z.string().optional(),
  actions: z.array(z.enum(['start', 'stop'])).optional(),
});

const suggestionModelDescriptorSchema = z.object({
  id: z.string(),
  label: z.string(),
  tier: z.enum(['included', 'premium', 'unknown']),
  pricing: z.string().optional(),
  provider: z.string().optional(),
  completionSource: z.enum(['copilot', 'opencode', 'ollama']).optional(),
});

const webviewSettingsPayloadSchema = z.object({
  completionProvider: z.enum(['copilot', 'opencode', 'ollama']),
  completionUiKind: z.enum(['copilot', 'opencode', 'ollama', 'multi']),
  enabledCompletionSources: z.array(z.enum(['copilot', 'opencode', 'ollama'])),
  suggestionModelPolicy: z.enum(['nonPremiumOnly', 'anyModel']),
  selectedModelId: z.string(),
  availableModels: z.array(suggestionModelDescriptorSchema),
  suggestionStyle: z.enum(['concise', 'balanced', 'detailed']),
  effectiveModel: z
    .object({
      id: z.string(),
      label: z.string(),
      tier: z.enum(['included', 'premium', 'unknown']),
      pricing: z.string().optional(),
      provider: z.string().optional(),
      completionSource: z.enum(['copilot', 'opencode', 'ollama']).optional(),
    })
    .optional(),
  debugSuggestions: z.boolean(),
  suggestionDebounceMs: z.number().min(150).max(2000),
  agentDestination: z.enum(['copilotChat', 'vsOpenCodeX', 'cursorChat']),
  vsOpenCodeXExtensionInstalled: z.boolean(),
  cursorDesktopHost: z.boolean(),
});

const webviewSettingsMessageSchema = z.object({
  type: z.literal('settings'),
  settings: webviewSettingsPayloadSchema,
});

const webviewInboundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('loading'), captureId: z.number(), phase: z.string().optional(), statusText: z.string().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal('suggestion-stream'), text: z.string(), captureId: z.number(), broadcast: z.boolean().optional() }),
  z.object({
    type: z.literal('suggestion'),
    suggestion: z.string(),
    captureId: z.number(),
    model: suggestionModelDescriptorSchema.optional(),
    broadcast: z.boolean().optional(),
  }).strict(),
  z.object({
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
  }),
  z.object({ type: z.literal('error'), message: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal('clear'), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal('draftSync'), text: z.string(), originViewId: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal('draftHydrate'), text: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal('providerStatus'), providers: z.array(providerStateRecordSchema), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  webviewSettingsMessageSchema,
]);

/**
 * Parses and validates an inbound webview payload.
 * @param {unknown} raw The raw input from the webview.
 * @returns {InboundMessage | undefined} A validated InboundMessage or undefined when validation fails.
 */
export function parseWebviewInboundMessage(raw: unknown): InboundMessage | undefined {
  const result = webviewInboundMessageSchema.safeParse(raw);
  if (!result.success) {
    return undefined;
  }
  return result.data;
}
