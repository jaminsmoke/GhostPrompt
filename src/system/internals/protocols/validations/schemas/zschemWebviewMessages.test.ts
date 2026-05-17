/**
 * @file Cobertura de variantes de mensaje webview; schemas canónicos en este directorio.
 * Comprueba alineación con `api/protocols/webviewProtocols.ts` (mismo objeto `webviewInboundMessageSchema`).
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

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
  'Uri': {
    joinPath: (...parts: unknown[]) => ({
      fsPath: parts.map((p) => { return typeof p === 'string' ? p : String(p); }).join('/'),
    }),
  },
}));

import { webviewInboundMessageSchema as hostInboundSchema } from '../../../../../api/protocols/webviewProtocols';

import {
  webviewInboundMessageSchema,
  webviewOutboundMessageSchema,
  webviewOutboundSettingsEnvelopeSchema,
  webviewSettingsPayloadSchema,
} from './zschemWebviewMessages';

vitest.describe('zschemWebviewMessages', () => {
  vitest.it('el host reexporta el mismo schema inbound que el módulo canónico', () => {
    vitest.expect(hostInboundSchema).toBe(webviewInboundMessageSchema);
  });

  vitest.it('acepta todas las variantes inbound documentadas', () => {
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
      vitest.expect(webviewInboundMessageSchema.safeParse(msg).success).toBe(true);
    }
  });

  vitest.it('settings payload con modelo efectivo opcional', () => {
    const r = webviewSettingsPayloadSchema.safeParse({
      completionProvider: 'copilot',
      completionUiKind: 'multi',
      enabledCompletionSources: ['copilot', 'opencode'],
      suggestionModelPolicy: 'anyModel',
      selectedModelId: 'auto',
      availableModels: [],
      suggestionStyle: 'concise',
      effectiveModel: {
        id: 'x',
        label: 'X',
        tier: 'included',
      },
      debugSuggestions: true,
      suggestionDebounceMs: 800,
      agentDestination: 'copilotChat' as const,
      vsOpenCodeXExtensionInstalled: false,
      cursorDesktopHost: false,
    });
    vitest.expect(r.success).toBe(true);
  });

  vitest.it('sobre settings outbound válido', () => {
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
        debugSuggestions: false,
        suggestionDebounceMs: 800,
        agentDestination: 'copilotChat' as const,
        vsOpenCodeXExtensionInstalled: false,
        cursorDesktopHost: false,
      },
    };
    vitest.expect(webviewOutboundSettingsEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  vitest.it('acepta el mensaje outbound empty con reason válido', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'no-model' as const,
      captureId: 1,
    };
    vitest.expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(true);
  });

  vitest.it('acepta el mensaje outbound empty con reason content-blocked', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'content-blocked' as const,
      captureId: 1,
    };
    vitest.expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(true);
  });

  vitest.it('rechaza el mensaje outbound empty con reason inválido', () => {
    const msg = {
      type: 'empty' as const,
      reason: 'unexpected-reason' as string,
      captureId: 1,
    };
    vitest.expect(webviewOutboundMessageSchema.safeParse(msg).success).toBe(false);
  });
});
