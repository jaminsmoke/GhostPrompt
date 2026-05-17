/**
 * @file Pruebas de handlers inbound del webview GhostPrompt.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const sendToChatMock = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());
const applyWebviewUpdateSettingMock = vi.hoisted(() => vi.fn());
const workspaceConfigGetMock = vi.hoisted(() => vi.fn((key: string, fallback: unknown) => fallback));
const handleGhostPromptSuggestMock = vi.hoisted(() => vi.fn().mockResolvedValue());
const getActiveDestinationProviderMock = vi.hoisted(
  () =>
    vi.fn<
      () => { id: 'copilotChat'; sendPrompt?: (text: string) => Promise<void> }
    >(() => ({
      id: 'copilotChat' as const,
      sendPrompt: sendToChatMock,
    })),
);
const windowShowErrorMessageMock = vi.hoisted(() => vi.fn());
const MockCancellationTokenSource = vi.hoisted(
  () =>
    class {
      public token = { isCancellationRequested: false };
      public cancel(): void {
        this.token.isCancellationRequested = true;
      }
      public dispose(): void { return; }
    },
);

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: workspaceConfigGetMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  extensions: {
    getExtension: vi.fn(() => { return; }),
  },
  window: {
    showErrorMessage: windowShowErrorMessageMock,
  },
  'CancellationTokenSource': MockCancellationTokenSource,
  'Disposable': class {
    constructor(private readonly _fn: () => void) {}
    dispose(): void {
      this._fn();
    }
  },
  'Uri': {
    joinPath: (...parts: (string | { fsPath?: string })[]) => ({
      fsPath: parts
        .map((p) => {
          return typeof p === 'string' ? p : p.fsPath ?? '';
        })
        .join('/'),
    }),
  },
}));

vi.mock('../../destinations/destinationRegistry', () => ({
  getAgentDestination: () =>
    workspaceConfigGetMock('agentDestination', 'copilotChat') as string,
  getActiveDestinationProvider: () => getActiveDestinationProviderMock(),
}));

vi.mock('../settings/applyWebviewUpdate', () => ({
  applyWebviewUpdateSetting: applyWebviewUpdateSettingMock,
}));

vi.mock('../../system/runtime/suggestRuntime', () => ({
  handleGhostPromptSuggest: handleGhostPromptSuggestMock,
}));

import { resetGhostPromptHostRuntimeForTests } from '../../system/runtime/resetHostRuntimeForTests';
import {
  getMultiViewDraftText,
  setMultiViewDraftText,
} from '../../ui/provider/multiViewDraft';

import {
  dispatchGhostPromptInboundMessage,
  handleGhostPromptInboundDraftChanged,
  handleGhostPromptInboundInit,
  handleGhostPromptInboundSend,
  type GhostPromptInboundDispatchServices,
} from './inboundHandlers';

import type { GhostPromptSuggestDeps } from '../../system/runtime/suggestRuntime';
import type * as Vscode from 'vscode';

/**
 * Returns minimal suggest runtime dependencies for inbound handler tests.
 * @returns {GhostPromptSuggestDeps} A basic GhostPromptSuggestDeps instance with test-safe defaults.
 */
function minimalSuggestDeps(): GhostPromptSuggestDeps {
  return {
    broadcastUi: vi.fn(),
    getSuggestionModelPolicy: () => 'nonPremiumOnly',
    getSelectedModelId: () => 'auto',
    getSuggestionStyle: () => 'balanced',
    getMaxSuggestionChars: () => 180,
  };
}

vitest.describe('ghostPromptWebviewInboundHandlers', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
    workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'copilotChat' : fallback;
    });
    resetGhostPromptHostRuntimeForTests();
  });

  vitest.describe('handleGhostPromptInboundDraftChanged', () => {
    vitest.it('no actualiza el store si originViewId no coincide con la vista', () => {
      const broadcast = vi.fn();
      handleGhostPromptInboundDraftChanged(
        {
          type: 'draftChanged',
          text: 'hola',
          originViewId: 'ghostPrompt.inputPanel',
        },
        {
          viewContributionId: 'ghostPrompt.input',
          broadcastDraftSync: broadcast,
        },
      );
      vitest.expect(getMultiViewDraftText()).toBe('');
      vitest.expect(broadcast).not.toHaveBeenCalled();
    });

    vitest.it('persiste el borrador y notifica a la otra vista', () => {
      const broadcast = vi.fn();
      handleGhostPromptInboundDraftChanged(
        {
          type: 'draftChanged',
          text: 'texto',
          originViewId: 'ghostPrompt.input',
        },
        {
          viewContributionId: 'ghostPrompt.input',
          broadcastDraftSync: broadcast,
        },
      );
      vitest.expect(getMultiViewDraftText()).toBe('texto');
      vitest.expect(broadcast).toHaveBeenCalledWith('ghostPrompt.input', 'texto');
    });
  });

  vitest.describe('handleGhostPromptInboundInit', () => {
    vitest.it('publica settings y rehidrata el borrador del store', async () => {
      setMultiViewDraftText('persistido');
      const postSettings = vi.fn().mockResolvedValue();
      const postMessage = vi.fn();
      const webview = { postMessage } as unknown as Vscode.Webview;

      await handleGhostPromptInboundInit(webview, postSettings);

      vitest.expect(postSettings).toHaveBeenCalledWith(webview);
      vitest.expect(postMessage).toHaveBeenCalledWith({
        type: 'draftHydrate',
        text: 'persistido',
      });
    });
  });

  vitest.describe('handleGhostPromptInboundSend', () => {
    vitest.it('registra el envío, envía al chat y limpia vistas', async () => {
      const clearAll = vi.fn();
      const dataUri = { fsPath: '/global-store' } as Vscode.Uri;

      await handleGhostPromptInboundSend({ type: 'send', text: 'prompt final' }, dataUri, clearAll);

      vitest.expect(sendToChatMock).toHaveBeenCalledWith('prompt final');
      vitest.expect(clearAll).toHaveBeenCalled();
    });

    vitest.it('no hace nada si text está vacío', async () => {
      await handleGhostPromptInboundSend(
        { type: 'send', text: '' },
        { fsPath: '/g' } as Vscode.Uri,
        vi.fn(),
      );
      vitest.expect(sendToChatMock).not.toHaveBeenCalled();
    });

    vitest.it('muestra error si el provider no tiene sendPrompt registrado', async () => {
      getActiveDestinationProviderMock.mockReturnValue({
        id: 'copilotChat' as const,
        sendPrompt: undefined,
      });
      const clearAll = vi.fn();
      await handleGhostPromptInboundSend(
        { type: 'send', text: 'prompt final' },
        { fsPath: '/global-store' } as Vscode.Uri,
        clearAll,
      );
      vitest.expect(sendToChatMock).not.toHaveBeenCalled();
      vitest.expect(windowShowErrorMessageMock).toHaveBeenCalledWith(
        "GhostPrompt: destino 'copilotChat' no tiene función de envío registrada.",
      );
      vitest.expect(clearAll).not.toHaveBeenCalled();
    });

    vitest.it('no envía si agentDestination es vsOpenCodeX', async () => {
      workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const clearAll = vi.fn();

      await handleGhostPromptInboundSend(
        { type: 'send', text: 'prompt final' },
        { fsPath: '/global-store' } as Vscode.Uri,
        clearAll,
      );

      vitest.expect(sendToChatMock).not.toHaveBeenCalled();
      vitest.expect(clearAll).not.toHaveBeenCalled();
    });
  });

  vitest.describe('dispatchGhostPromptInboundMessage', () => {
    vitest.it('enruta updateSetting a apply + refresh de settings', async () => {
      applyWebviewUpdateSettingMock.mockResolvedValue();
      const broadcastSettings = vi.fn().mockResolvedValue();
      const webview = {} as Vscode.Webview;

      const services: GhostPromptInboundDispatchServices = {
        viewContributionId: 'ghostPrompt.input',
        webview,
        dataUri: { fsPath: '/g' } as Vscode.Uri,
        postSettings: vi.fn(),
        broadcastDraftSync: vi.fn(),
        broadcastSettingsToAllViews: broadcastSettings,
        broadcastClearAll: vi.fn(),
        broadcastUi: vi.fn(),
        suggestDeps: minimalSuggestDeps(),
      };

      await dispatchGhostPromptInboundMessage(
        {
          type: 'updateSetting',
          key: 'suggestionStyle',
          value: 'concise',
        },
        services,
      );

      vitest.expect(applyWebviewUpdateSettingMock).toHaveBeenCalledWith(
        vitest.expect.objectContaining({
          type: 'updateSetting',
          key: 'suggestionStyle',
          value: 'concise',
        }),
      );
      vitest.expect(broadcastSettings).toHaveBeenCalled();
    });

    vitest.it('ignora suggest si agentDestination es vsOpenCodeX', async () => {
      workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
      const broadcastUi = vi.fn();
      const services: GhostPromptInboundDispatchServices = {
        viewContributionId: 'ghostPrompt.input',
        webview: {} as Vscode.Webview,
        dataUri: { fsPath: '/g' } as Vscode.Uri,
        postSettings: vi.fn(),
        broadcastDraftSync: vi.fn(),
        broadcastSettingsToAllViews: vi.fn(),
        broadcastClearAll: vi.fn(),
        broadcastUi: vi.fn(),
        suggestDeps: {
          ...minimalSuggestDeps(),
          broadcastUi,
        },
      };

      await dispatchGhostPromptInboundMessage(
        { type: 'suggest', text: 'abc', captureId: 99 },
        services,
      );

      vitest.expect(handleGhostPromptSuggestMock).not.toHaveBeenCalled();
      vitest.expect(broadcastUi).not.toHaveBeenCalled();
    });
  });
});
