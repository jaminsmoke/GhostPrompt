/**
 * @file Pruebas de validación de protocolo webview (boundary host).
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import { DEFAULT_SUGGESTION_DEBOUNCE_MS } from '../../system/internals/protocols/constants/consPipelineDefaults';
import {
  invalidWebviewSettingsBadTierEnvelope,
  minimalWebviewSettingsPayload,
  webviewOutboundInvalidFixtures,
  webviewOutboundValidFixtures,
} from '../../system/internals/protocols/validations/schemas/fixtures/webviewOutboundMessageFixtures';
import {
  webviewInboundMessageSchema as canonicalInboundSchema,
  webviewOutboundMessageSchema,
} from '../../system/internals/protocols/validations/schemas/zschemWebviewMessages';
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
  parseWebviewOutboundMessage,
  webviewInboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
} from './webviewProtocols';

vitest.describe('webviewProtocols (v0.3.1 Fase B)', () => {
  vitest.it('reexporta el mismo schema inbound que el módulo canónico en protocols', () => {
    vitest.expect(webviewInboundMessageSchema).toBe(canonicalInboundSchema);
  });

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
    const envelope = webviewOutboundValidFixtures.find((f) => f.id === 'settings-with-model')?.raw;
    vitest.expect(envelope).toBeDefined();
    vitest.expect(parseOutboundSettingsEnvelope(envelope)).toEqual(envelope);
    vitest.expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  vitest.it('rechaza settings saliente con tier inválido', () => {
    vitest.expect(parseOutboundSettingsEnvelope(invalidWebviewSettingsBadTierEnvelope)).toBe(false);
  });

  vitest.describe('paridad host → webview (fixtures compartidos con webview)', () => {
    vitest.it.each(webviewOutboundValidFixtures.map((fixture) => [fixture.id, fixture.raw]))(
      'parseWebviewOutboundMessage acepta %s',
      (_id, raw) => {
        const fromSchema = webviewOutboundMessageSchema.safeParse(raw);
        vitest.expect(fromSchema.success).toBe(true);
        if (!fromSchema.success) {
          return;
        }
        vitest.expect(parseWebviewOutboundMessage(raw)).toEqual(fromSchema.data);
      },
    );

    vitest.it.each(
      webviewOutboundInvalidFixtures.map((raw, index) => [`#${index}`, raw] as const),
    )('parseWebviewOutboundMessage rechaza %s', (_label, raw) => {
      vitest.expect(webviewOutboundMessageSchema.safeParse(raw).success).toBe(false);
      vitest.expect(parseWebviewOutboundMessage(raw)).toBe(false);
    });
  });

  vitest.it('webviewSettingsPayloadSchema coincide con modelo descriptor', () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      ...minimalWebviewSettingsPayload,
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

  vitest.it('DEFAULT_SUGGESTION_DEBOUNCE_MS sigue en fixtures mínimos', () => {
    vitest.expect(minimalWebviewSettingsPayload.suggestionDebounceMs).toBe(
      DEFAULT_SUGGESTION_DEBOUNCE_MS,
    );
  });
});
