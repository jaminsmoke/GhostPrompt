/**
 * @file Pruebas de validación de protocolo webview.
 */import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(),
      inspect: vi.fn(() => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
    }),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  ['Uri']: {
    joinPath: (...parts: unknown[]) => ({
      fsPath: parts.map((p) => (typeof p === 'string' ? p : String(p))).join('/'),
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
  effectiveModel: undefined,
  debugSuggestions: false,
  suggestionDebounceMs: 800,
  agentDestination: 'copilotChat' as const,
  vsOpenCodeXExtensionInstalled: false,
  cursorDesktopHost: false,
};

describe('webviewProtocols (v0.3.1 Fase B)', () => {
  it('acepta mensajes entrantes válidos', () => {
    expect(parseWebviewInboundMessage({ type: 'init' })).toEqual({ type: 'init' });
    expect(
      parseWebviewInboundMessage({
        type: 'suggest',
        text: 'hola',
        captureId: 1,
      }),
    ).toMatchObject({ type: 'suggest', captureId: 1 });
    expect(
      parseWebviewInboundMessage({
        type: 'draftChanged',
        text: 'x',
        originViewId: 'ghostPrompt.input',
      }),
    ).toMatchObject({ type: 'draftChanged' });
    expect(
      parseWebviewInboundMessage({
        type: 'log',
        level: 'debug',
        message: 'test-log',
      }),
    ).toMatchObject({ type: 'log', level: 'debug', message: 'test-log' });
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'debugSuggestions',
        value: true,
      }),
    ).toMatchObject({ key: 'debugSuggestions', value: true });
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'selectedModelId',
        value: 'openai/gpt-4',
      }),
    ).toMatchObject({ key: 'selectedModelId' });
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'vsOpenCodeX',
      }),
    ).toMatchObject({ key: 'agentDestination', value: 'vsOpenCodeX' });
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'cursorChat',
      }),
    ).toMatchObject({ key: 'agentDestination', value: 'cursorChat' });
  });

  it('rechaza mensajes entrantes inválidos', () => {
    expect(parseWebviewInboundMessage(null)).toBeUndefined();
    expect(parseWebviewInboundMessage({})).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: 'suggest',
        text: 'x',
        captureId: '1',
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'debugSuggestions',
        value: 'true',
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'suggestionStyle',
        value: 'fancy',
      }),
    ).toBeUndefined();
    expect(
      parseWebviewInboundMessage({
        type: 'updateSetting',
        key: 'agentDestination',
        value: 'other',
      }),
    ).toBeUndefined();
  });

  it('acepta sobre settings saliente válido', () => {
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
    expect(parseOutboundSettingsEnvelope(envelope)).toEqual(envelope);
    expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('rechaza settings saliente con tier inválido', () => {
    const bad = {
      type: 'settings' as const,
      settings: {
        ...minimalSettingsPayload,
        availableModels: [{ id: 'x', label: 'X', tier: 'free' }],
      },
    };
    expect(parseOutboundSettingsEnvelope(bad)).toBeUndefined();
  });

  it('webviewSettingsPayloadSchema coincide con modelo descriptor', () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      ...minimalSettingsPayload,
      effectiveModel: {
        id: 'a',
        label: 'A',
        tier: 'premium',
        pricing: '1x',
      },
    });
    expect(r.success).toBe(true);
  });

  it('webviewInboundMessageSchema cubre updateSetting discriminado', () => {
    const r = webviewInboundMessageSchema.safeParse({
      type: 'updateSetting',
      key: 'suggestionStyle',
      value: 'concise',
    });
    expect(r.success).toBe(true);
  });
});
