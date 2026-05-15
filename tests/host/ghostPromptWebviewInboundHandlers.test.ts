import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sendToChatMock,
  applyWebviewUpdateSettingMock,
  workspaceConfigGetMock,
  handleGhostPromptSuggestMock,
  getActiveDestinationProviderMock,
  windowShowErrorMessageMock,
  MockCancellationTokenSource,
} = vi.hoisted(() => ({
  sendToChatMock: vi.fn(),
  applyWebviewUpdateSettingMock: vi.fn(),
  workspaceConfigGetMock: vi.fn((key: string, fallback: unknown) => fallback),
  handleGhostPromptSuggestMock: vi.fn().mockResolvedValue(undefined),
  getActiveDestinationProviderMock: vi.fn(() => ({
    id: 'copilotChat' as const,
    sendPrompt: sendToChatMock,
  })),
  windowShowErrorMessageMock: vi.fn(),
  MockCancellationTokenSource: class {
    public token = { isCancellationRequested: false };
    public cancel(): void {
      this.token.isCancellationRequested = true;
    }
    public dispose(): void {}
  },
}));

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
  CancellationTokenSource: MockCancellationTokenSource,
  Disposable: class {
    constructor(private readonly _fn: () => void) {}
    dispose(): void {
      this._fn();
    }
  },
  Uri: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === 'string' ? p : (p.fsPath ?? ''))).join('/'),
    }),
  },
}));

vi.mock('../../src/destinations/destinationRegistry', () => ({
  getGhostPromptAgentDestination: () =>
    workspaceConfigGetMock('agentDestination', 'copilotChat') as string,
  getActiveDestinationProvider: () => getActiveDestinationProviderMock(),
}));

vi.mock('../../src/api/settings/applyWebviewUpdate', () => ({
  applyWebviewUpdateSetting: applyWebviewUpdateSettingMock,
}));

vi.mock('../../src/core/suggest', () => ({
  handleGhostPromptSuggest: (...args: unknown[]) => handleGhostPromptSuggestMock(...args),
}));

import type { Uri, Webview } from 'vscode';
import { ghostPromptSessionStore } from '../../src/core/state/GhostPromptSessionStore';
import {
  dispatchGhostPromptInboundMessage,
  handleGhostPromptInboundDraftChanged,
  handleGhostPromptInboundInit,
  handleGhostPromptInboundSend,
  type GhostPromptInboundDispatchServices,
} from '../../src/api/protocols/inboundHandlers';
import type { GhostPromptSuggestDeps } from '../../src/core/suggest';

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
    ghostPromptSessionStore.resetSessionState();
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
      expect(ghostPromptSessionStore.getSnapshot().draftText).toBe('');
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
      expect(ghostPromptSessionStore.getSnapshot().draftText).toBe('texto');
      expect(broadcast).toHaveBeenCalledWith('ghostPrompt.input', 'texto');
    });
  });

  describe('handleGhostPromptInboundInit', () => {
    it('publica settings y rehidrata el borrador del store', async () => {
      ghostPromptSessionStore.patchState({ draftText: 'persistido' });
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

      expect(ghostPromptSessionStore.getSnapshot().lastSentPrompt).toBe('prompt final');
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
        sendPrompt: undefined as any,
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
