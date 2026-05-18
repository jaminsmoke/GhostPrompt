/**
 * @file Pruebas de validación de protocolo webview.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import { DEFAULT_SUGGESTION_DEBOUNCE_MS } from '../../system/internals/protocols/constants/consPipelineDefaults';
import { emptyConfigurationInspect } from '../../system/internals/testing/mockVscodeConfigurationInspect';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(),
      inspect: vi.fn(() => emptyConfigurationInspect),
    }),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  'Uri': {
    joinPath: (...parts: unknown[]) => ({
      fsPath: parts.map((p) => { return typeof p === 'string' ? p : String(p); }).join('/'),
    }),
  },
}));

import {
  parseOutboundSettingsEnvelope,
  parseWebviewInboundMessage,
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
} from './webviewProtocols';

const minimalSettingsPayload = {
  completionProvider: 'copilot' as const,
  completionUiKind: 'copilot' as const,
  enabledCompletionSources: ['copilot'] as const,
  suggestionModelPolicy: 'nonPremiumOnly' as const,
  selectedModelId: 'auto',
  availableModels: [] as const,
  suggestionStyle: 'balanced' as const,
  debugSuggestions: false,
  suggestionDebounceMs: DEFAULT_SUGGESTION_DEBOUNCE_MS,
  agentDestination: 'copilotChat' as const,
  vsOpenCodeXExtensionInstalled: false,
  cursorDesktopHost: false,
};

vitest.describe('webviewProtocols (v0.3.1 Fase B)', () => {
  vitest.it('acepta mensajes entrantes válidos', () => {
    vitest.expect(parseWebviewInboundMessage({ type: 'init' })).toEqual({ type: 'init' });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'suggest',
        text: 'hola',
        captureId: 1,
      }),
    ).toMatchObject({ type: 'suggest', captureId: 1 });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'draftChanged',
        text: 'x',
        originViewId: 'ghostPrompt.input',
      }),
    ).toMatchObject({ type: 'draftChanged' });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'log',
        level: 'debug',
        message: 'test-log',
      }),
    ).toMatchObject({ type: 'log', level: 'debug', message: 'test-log' });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'debugSuggestions',
        value: true,
      }),
    ).toMatchObject({ key: 'debugSuggestions', value: true });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'selectedModelId',
        value: 'openai/gpt-4',
      }),
    ).toMatchObject({ key: 'selectedModelId' });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'vsOpenCodeX',
      }),
    ).toMatchObject({ key: 'agentDestination', value: 'vsOpenCodeX' });
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'cursorChat',
      }),
    ).toMatchObject({ key: 'agentDestination', value: 'cursorChat' });
  });

  vitest.it('rechaza mensajes entrantes inválidos', () => {
    vitest.expect(parseWebviewInboundMessage()).toBe(false);
    vitest.expect(parseWebviewInboundMessage({})).toBe(false);
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'suggest',
        text: 'x',
        captureId: '1',
      }),
    ).toBe(false);
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'debugSuggestions',
        value: 'true',
      }),
    ).toBe(false);
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'suggestionStyle',
        value: 'fancy',
      }),
    ).toBe(false);
    vitest.expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'other',
      }),
    ).toBe(false);
  });

  vitest.it('acepta sobre settings saliente válido', () => {
    const envelope = {
      type: 'settings' as const,
      settings: {
        ...minimalSettingsPayload,
        availableModels: [
          {
            id: 'm',
            label: 'M',
            tier: 'included' as const,
            completionSource: 'copilot' as const,
          },
        ],
      },
    };
    vitest.expect(parseOutboundSettingsEnvelope(envelope)).toEqual(envelope);
    vitest.expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  vitest.it('rechaza settings saliente con tier inválido', () => {
    const bad = {
      type: 'settings' as const,
      settings: {
        ...minimalSettingsPayload,
        availableModels: [{ id: 'x', label: 'X', tier: 'free' }],
      },
    };
    vitest.expect(parseOutboundSettingsEnvelope(bad)).toBe(false);
  });

  vitest.it('webviewSettingsPayloadSchema coincide con modelo descriptor', () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      ...minimalSettingsPayload,
      effectiveModel: {
        id: 'a',
        label: 'A',
        tier: 'premium',
        pricing: '1x',
      },
    });
    vitest.expect(r.success).toBe(true);
  });

  vitest.it('webviewInboundMessageSchema cubre updateSetting discriminado', () => {
    const r = webviewInboundMessageSchema.safeParse({
      type: 'updateSetting',
      key: 'suggestionStyle',
      value: 'concise',
    });
    vitest.expect(r.success).toBe(true);
  });
});
