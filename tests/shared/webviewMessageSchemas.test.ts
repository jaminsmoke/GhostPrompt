/**
 * Cobertura por variante de mensaje definida en `src/shared/webviewMessageSchemas.ts`.
 * El host reexporta los mismos schemas desde `src/host/webviewProtocols.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
} from '../../src/system/contracts/webviewMessageSchemas';
import { webviewInboundMessageSchema as hostInboundSchema } from '../../src/api/protocols/webviewProtocols';

describe('webviewMessageSchemas (shared)', () => {
  it('el host reexporta el mismo schema inbound que shared', () => {
    expect(hostInboundSchema).toBe(webviewInboundMessageSchema);
  });

  it('acepta todas las variantes inbound documentadas', () => {
    const samples = [
      { type: 'init' as const },
      {
        type: 'suggest' as const,
        text: 't',
        captureId: 1,
      },
      {
        type: 'draftChanged' as const,
        text: '',
        originViewId: 'ghostPrompt.input',
      },
      {
        type: 'accept' as const,
        context: 'c',
        suggestion: 's',
      },
      { type: 'send' as const, text: 'hola' },
      {
        type: 'updateSetting' as const,
        key: 'suggestionModelPolicy' as const,
        value: 'nonPremiumOnly' as const,
      },
      {
        type: 'updateSetting' as const,
        key: 'selectedModelId' as const,
        value: 'openai/gpt-4',
      },
      {
        type: 'updateSetting' as const,
        key: 'suggestionStyle' as const,
        value: 'detailed' as const,
      },
      {
        type: 'updateSetting' as const,
        key: 'suggestionLanguageChoice' as const,
        value: 'es' as const,
      },
      {
        type: 'updateSetting' as const,
        key: 'debugSuggestions' as const,
        value: false,
      },
      {
        type: 'updateSetting' as const,
        key: 'completionProvider' as const,
        value: 'opencode' as const,
      },
      {
        type: 'updateSetting' as const,
        key: 'agentDestination' as const,
        value: 'vsOpenCodeX' as const,
      },
    ];
    for (const msg of samples) {
      expect(webviewInboundMessageSchema.safeParse(msg).success).toBe(true);
    }
  });

  it('settings payload con modelo efectivo opcional', () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      completionProvider: 'copilot',
      completionUiKind: 'multi',
      enabledCompletionSources: ['copilot', 'opencode'],
      suggestionModelPolicy: 'anyModel',
      selectedModelId: 'auto',
      availableModels: [],
      suggestionStyle: 'concise',
      suggestionLanguageChoice: 'auto',
      effectiveSuggestionLanguage: 'es',
      effectiveModel: {
        id: 'x',
        label: 'X',
        tier: 'included',
      },
      debugSuggestions: true,
      suggestionDebounceMs: 800,
      agentDestination: 'copilotChat' as const,
      vsOpenCodeXExtensionInstalled: false,
    });
    expect(r.success).toBe(true);
  });

  it('sobre settings outbound válido', () => {
    const envelope = {
      type: 'settings' as const,
      settings: {
        completionProvider: 'opencode' as const,
        completionUiKind: 'opencode' as const,
        enabledCompletionSources: ['opencode'] as const,
        suggestionModelPolicy: 'nonPremiumOnly' as const,
        selectedModelId: 'auto',
        availableModels: [],
        suggestionStyle: 'balanced' as const,
        suggestionLanguageChoice: 'auto' as const,
        effectiveSuggestionLanguage: 'en' as const,
        debugSuggestions: false,
        suggestionDebounceMs: 800,
        agentDestination: 'copilotChat' as const,
        vsOpenCodeXExtensionInstalled: false,
      },
    };
    expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('acepta el mensaje outbound languageEffective', () => {
    const msg = {
      type: 'languageEffective' as const,
      language: 'es' as const,
      captureId: 1,
      broadcast: true,
    };
    expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(true);
  });

  it('acepta el mensaje outbound empty con reason válido', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'no-model' as const,
      captureId: 1,
    };
    expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(true);
  });

  it('acepta el mensaje outbound empty con reason content-blocked', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'content-blocked' as const,
      captureId: 1,
    };
    expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(true);
  });

  it('rechaza el mensaje outbound empty con reason inválido', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'unexpected-reason' as string,
      captureId: 1,
    };
    expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(false);
  });
});
