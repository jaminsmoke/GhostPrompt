/**
 * @file Pruebas de handlers inbound del webview GhostPrompt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendToChatMock = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());
const applyWebviewUpdateSettingMock = vi.hoisted(() => vi.fn());
const workspaceConfigGetMock = vi.hoisted(() => vi.fn((key: string, fallback: unknown) => fallback));
const handleGhostPromptSuggestMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
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
      public dispose(): void {}
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
    getExtension: vi.fn(() => undefined),
  },
  window: {
    showErrorMessage: windowShowErrorMessageMock,
  },
  ['CancellationTokenSource']: MockCancellationTokenSource,
  ['Disposable']: class {
    constructor(private readonly _fn: () => void) {}
    dispose(): void {
      this._fn();
    }
  },
  ['Uri']: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === 'string' ? p : (p.fsPath ?? ''))).join('/'),
    }),
  },
}));

vi.mock('../../destinations/destinationRegistry', () => ({
  getGhostPromptAgentDestination: () =>
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
import type { Uri, Webview } from 'vscode';

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

describe('ghostPromptWebviewInboundHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === 'agentDestination' ? 'copilotChat' : fallback,
    );
    resetGhostPromptHostRuntimeForTests();
  });

  describe('handleGhostPromptInboundDraftChanged', () => {
    it('no actualiza el store si originViewId no coincide con la vista', () => {
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
      expect(getMultiViewDraftText()).toBe('');
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('persiste el borrador y notifica a la otra vista', () => {
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
      expect(getMultiViewDraftText()).toBe('texto');
      expect(broadcast).toHaveBeenCalledWith('ghostPrompt.input', 'texto');
    });
  });

  describe('handleGhostPromptInboundInit', () => {
    it('publica settings y rehidrata el borrador del store', async () => {
      setMultiViewDraftText('persistido');
      const postSettings = vi.fn().mockResolvedValue(undefined);
      const postMessage = vi.fn();
      const webview = { postMessage } as unknown as Webview;

      await handleGhostPromptInboundInit(webview, postSettings);

      expect(postSettings).toHaveBeenCalledWith(webview);
      expect(postMessage).toHaveBeenCalledWith({
        type: 'draftHydrate',
        text: 'persistido',
      });
    });
  });

  describe('handleGhostPromptInboundSend', () => {
    it('registra el envío, envía al chat y limpia vistas', async () => {
      const clearAll = vi.fn();
      const dataUri = { fsPath: '/global-store' } as Uri;

      await handleGhostPromptInboundSend({ type: 'send', text: 'prompt final' }, dataUri, clearAll);

      expect(sendToChatMock).toHaveBeenCalledWith('prompt final');
      expect(clearAll).toHaveBeenCalled();
    });

    it('no hace nada si text está vacío', async () => {
      await handleGhostPromptInboundSend(
        { type: 'send', text: '' },
        { fsPath: '/g' } as Uri,
        vi.fn(),
      );
      expect(sendToChatMock).not.toHaveBeenCalled();
    });

    it('muestra error si el provider no tiene sendPrompt registrado', async () => {
      getActiveDestinationProviderMock.mockReturnValue({
        id: 'copilotChat' as const,
        sendPrompt: undefined,
      });
      const clearAll = vi.fn();
      await handleGhostPromptInboundSend(
        { type: 'send', text: 'prompt final' },
        { fsPath: '/global-store' } as Uri,
        clearAll,
      );
      expect(sendToChatMock).not.toHaveBeenCalled();
      expect(windowShowErrorMessageMock).toHaveBeenCalledWith(
        "GhostPrompt: destino 'copilotChat' no tiene función de envío registrada.",
      );
      expect(clearAll).not.toHaveBeenCalled();
    });

    it('no envía si agentDestination es vsOpenCodeX', async () => {
      workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) =>
        key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
      );
      const clearAll = vi.fn();

      await handleGhostPromptInboundSend(
        { type: 'send', text: 'prompt final' },
        { fsPath: '/global-store' } as Uri,
        clearAll,
      );

      expect(sendToChatMock).not.toHaveBeenCalled();
      expect(clearAll).not.toHaveBeenCalled();
    });
  });

  describe('dispatchGhostPromptInboundMessage', () => {
    it('enruta updateSetting a apply + refresh de settings', async () => {
      applyWebviewUpdateSettingMock.mockResolvedValue(undefined);
      const broadcastSettings = vi.fn().mockResolvedValue(undefined);
      const webview = {} as Webview;

      const services: GhostPromptInboundDispatchServices = {
        viewContributionId: 'ghostPrompt.input',
        webview,
        dataUri: { fsPath: '/g' } as Uri,
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

      expect(applyWebviewUpdateSettingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateSetting',
          key: 'suggestionStyle',
          value: 'concise',
        }),
      );
      expect(broadcastSettings).toHaveBeenCalled();
    });

    it('ignora suggest si agentDestination es vsOpenCodeX', async () => {
      workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) =>
        key === 'agentDestination' ? 'vsOpenCodeX' : fallback,
      );
      const broadcastUi = vi.fn();
      const services: GhostPromptInboundDispatchServices = {
        viewContributionId: 'ghostPrompt.input',
        webview: {} as Webview,
        dataUri: { fsPath: '/g' } as Uri,
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

      expect(handleGhostPromptSuggestMock).not.toHaveBeenCalled();
      expect(broadcastUi).not.toHaveBeenCalled();
    });
  });
});
