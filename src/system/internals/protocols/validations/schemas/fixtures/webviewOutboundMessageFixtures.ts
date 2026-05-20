/**
 * @file Casos de muestra host → webview (`webviewOutboundMessageSchema`) para tests de paridad.
 */
import { DEFAULT_SUGGESTION_DEBOUNCE_MS } from '../../../constants/consPipelineDefaults';

/** Payload `settings` mínimo válido. */
export const minimalWebviewSettingsPayload = {
  completionProvider: 'copilot' as const,
  completionUiKind: 'copilot' as const,
  enabledCompletionSources: ['copilot'] as const,
  suggestionModelPolicy: 'nonPremiumOnly' as const,
  selectedModelId: 'auto',
  availableModels: [] as const,
  maxSuggestionChars: 270,
  debugSuggestions: false,
  suggestionDebounceMs: DEFAULT_SUGGESTION_DEBOUNCE_MS,
  agentDestination: 'copilotChat' as const,
  vsOpenCodeXExtensionInstalled: false,
  cursorDesktopHost: false,
};

export type WebviewOutboundValidFixture = {
  id: string;
  raw: unknown;
};

/** Mensajes host → panel que deben pasar `webviewOutboundMessageSchema`. */
export const webviewOutboundValidFixtures: readonly WebviewOutboundValidFixture[] = [
  {
    id: 'settings',
    raw: {
      type: 'settings',
      settings: minimalWebviewSettingsPayload,
    },
  },
  {
    id: 'settings-with-model',
    raw: {
      type: 'settings',
      settings: {
        ...minimalWebviewSettingsPayload,
        availableModels: [
          {
            id: 'm',
            label: 'M',
            tier: 'included' as const,
            completionSource: 'copilot' as const,
          },
        ],
      },
    },
  },
  {
    id: 'providerStatus',
    raw: {
      type: 'providerStatus',
      providers: [
        {
          id: 'copilot',
          status: 'running',
          label: 'Copilot',
        },
      ],
    },
  },
  {
    id: 'loading',
    raw: { type: 'loading', captureId: 1, phase: 'fetch', statusText: '…' },
  },
  {
    id: 'suggestion',
    raw: { type: 'suggestion', suggestion: 'hello', captureId: 2 },
  },
  {
    id: 'suggestion-stream',
    raw: { type: 'suggestion-stream', text: 'partial', captureId: 3 },
  },
  {
    id: 'empty',
    raw: { type: 'empty', reason: 'too-short', captureId: 4 },
  },
  {
    id: 'error',
    raw: { type: 'error', message: 'fail', captureId: 5 },
  },
  {
    id: 'clear',
    raw: { type: 'clear', captureId: 6 },
  },
  {
    id: 'draftHydrate',
    raw: { type: 'draftHydrate', text: 'hydrated' },
  },
];

/** Settings con `tier` de modelo inválido (caso usado en boundary + webview). */
export const invalidWebviewSettingsBadTierEnvelope = {
  type: 'settings' as const,
  settings: {
    ...minimalWebviewSettingsPayload,
    availableModels: [{ id: 'x', label: 'X', tier: 'free' }],
  },
};

/** Payloads que deben fallar `webviewOutboundMessageSchema` (objetos malformados). */
export const webviewOutboundInvalidFixtures: readonly unknown[] = [
  {},
  { type: 'unknown-type' },
  {
    type: 'settings',
    settings: {
      ...minimalWebviewSettingsPayload,
      completionProvider: 'invalid',
    },
  },
  invalidWebviewSettingsBadTierEnvelope,
  {
    type: 'suggestion',
    suggestion: 'x',
    captureId: '1',
  },
  {
    type: 'empty',
    reason: 'not-a-reason',
    captureId: 1,
  },
];
