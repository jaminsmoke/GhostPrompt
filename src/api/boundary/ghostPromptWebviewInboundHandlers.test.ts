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

vi.mock('vscode', async () => {
  const tokenModule = (await import('./testing/mockCancellationTokenSource')) as unknown as Record<
    string,
    new () => { token: { isCancellationRequested: boolean } }
  >;
  const disposableModule = (await import('./testing/mockDisposable')) as unknown as Record<
    string,
    new (disposeFunction: () => void) => { dispose: () => void }
  >;

  return {
    workspace: {
      getConfiguration: () => ({
        get: workspaceConfigGetMock,
        inspect: () => ({}),
      }),
    },
    extensions: {
      getExtension: vi.fn(),
    },
    window: {
      showErrorMessage: windowShowErrorMessageMock,
    },
    CancellationTokenSource: tokenModule.MockCancellationTokenSource,
    Disposable: disposableModule.MockDisposable,
    Uri: {
      joinPath: (...parts: (string | { fsPath?: string })[]) => ({
        fsPath: parts
          .map((p) => {
            return typeof p === 'string' ? p : p.fsPath ?? '';
          })
          .join('/'),
      }),
    },
  };
});

vi.mock('../../destinations/destinationRegistry', () => ({
  getAgentDestination: () =>
    workspaceConfigGetMock('agentDestination', 'copilotChat') as string,
  getActiveDestinationProvider: () => getActiveDestinationProviderMock(),
}));

vi.mock('../../system/internals/config/write/applyWebviewUpdateSetting', () => ({
  applyWebviewUpdateSetting: applyWebviewUpdateSettingMock,
}));

vi.mock('../../system/runtime/suggest/suggestPipeline', () => ({
  handleGhostPromptSuggest: handleGhostPromptSuggestMock,
}));

import { DEFAULT_MAX_SUGGESTION_CHARS } from '../../system/internals/protocols/constants/consPipelineDefaults';
import { resetGhostPromptHostRuntimeForTests } from '../../system/runtime/testing/resetHostRuntimeForTests';
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

import type { GhostPromptSuggestDeps } from '../../system/runtime/suggest/suggestPipeline';
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
    getMaxSuggestionChars: () => DEFAULT_MAX_SUGGESTION_CHARS,
  };
}

/**
 * Restaura mocks compartidos antes de cada caso de handlers inbound.
 * @returns {void}
 */
function resetInboundHandlerMocks(): void {
  vi.clearAllMocks();
  workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
    return key === 'agentDestination' ? 'copilotChat' : fallback;
  });
  resetGhostPromptHostRuntimeForTests();
}

/**
 * Construye servicios de dispatch mínimos para tests de handlers inbound.
 * @param {Partial<GhostPromptInboundDispatchServices>} overrides - Sustituye propiedades del objeto base.
 * @returns {GhostPromptInboundDispatchServices} Servicios listos para `dispatchGhostPromptInboundMessage`.
 */
function baseServices(
  overrides: Partial<GhostPromptInboundDispatchServices> = {},
): GhostPromptInboundDispatchServices {
  return {
    viewContributionId: 'ghostPrompt.input',
    surfaceRole: 'chat',
    webview: {} as Vscode.Webview,
    dataUri: { fsPath: '/g' } as Vscode.Uri,
    postSettings: vi.fn(),
    broadcastSettingsToAllViews: vi.fn(),
    broadcastClearAll: vi.fn(),
    broadcastUi: vi.fn(),
    suggestDeps: minimalSuggestDeps(),
    ...overrides,
  };
}

vitest.describe('handleGhostPromptInboundDraftChanged', () => {
  vitest.beforeEach(resetInboundHandlerMocks);

  vitest.it('no actualiza el store si originViewId no coincide con la vista', () => {
    handleGhostPromptInboundDraftChanged(
      {
        type: 'draftChanged',
        text: 'hola',
        originViewId: 'ghostPrompt.inputPanel',
      },
      {
        viewContributionId: 'ghostPrompt.input',
        surfaceRole: 'chat',
      },
    );
    vitest.expect(getMultiViewDraftText()).toBe('');
  });

  vitest.it('superficie hub no persiste borrador compartido', () => {
    handleGhostPromptInboundDraftChanged(
      {
        type: 'draftChanged',
        text: 'desde hub',
        originViewId: 'ghostPrompt.inputPanel',
      },
      {
        viewContributionId: 'ghostPrompt.inputPanel',
        surfaceRole: 'hub',
      },
    );
    vitest.expect(getMultiViewDraftText()).toBe('');
  });

  vitest.it('persiste el borrador en la vista chat cuando coincide originViewId', () => {
    handleGhostPromptInboundDraftChanged(
      {
        type: 'draftChanged',
        text: 'texto',
        originViewId: 'ghostPrompt.input',
      },
      {
        viewContributionId: 'ghostPrompt.input',
        surfaceRole: 'chat',
      },
    );
    vitest.expect(getMultiViewDraftText()).toBe('texto');
  });
});

vitest.describe('handleGhostPromptInboundInit', () => {
  vitest.beforeEach(resetInboundHandlerMocks);

  vitest.it('publica settings y rehidrata el borrador solo en superficie chat', async () => {
    setMultiViewDraftText('persistido');
    const postSettings = vi.fn().mockResolvedValue();
    const postMessage = vi.fn();
    const webview = { postMessage } as unknown as Vscode.Webview;

    await handleGhostPromptInboundInit(webview, postSettings, 'chat');

    vitest.expect(postSettings).toHaveBeenCalledWith(webview);
    vitest.expect(postMessage).toHaveBeenCalledWith({
      type: 'draftHydrate',
      text: 'persistido',
    });
  });

  vitest.it('en hub solo publica settings sin draftHydrate', async () => {
    setMultiViewDraftText('solo-chat');
    const postSettings = vi.fn().mockResolvedValue();
    const postMessage = vi.fn();
    const webview = { postMessage } as unknown as Vscode.Webview;

    await handleGhostPromptInboundInit(webview, postSettings, 'hub');

    vitest.expect(postSettings).toHaveBeenCalledWith(webview);
    vitest.expect(postMessage).not.toHaveBeenCalled();
  });
});

vitest.describe('handleGhostPromptInboundSend', () => {
  vitest.beforeEach(resetInboundHandlerMocks);

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
  vitest.beforeEach(resetInboundHandlerMocks);

  vitest.it('enruta updateSetting a apply (refresh vía onDidChangeConfiguration)', async () => {
    applyWebviewUpdateSettingMock.mockResolvedValue();
    const broadcastSettings = vi.fn().mockResolvedValue();

    await dispatchGhostPromptInboundMessage(
      {
        type: 'updateSetting',
        key: 'maxSuggestionChars',
        value: 40,
      },
      baseServices({
        broadcastSettingsToAllViews: broadcastSettings,
        surfaceRole: 'hub',
      }),
    );

    vitest.expect(applyWebviewUpdateSettingMock).toHaveBeenCalledWith(
      vitest.expect.objectContaining({
        type: 'updateSetting',
        key: 'maxSuggestionChars',
        value: 40,
      }),
    );
    vitest.expect(broadcastSettings).not.toHaveBeenCalled();
  });

  vitest.it('ignora suggest si agentDestination es vsOpenCodeX', async () => {
    workspaceConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
      return key === 'agentDestination' ? 'vsOpenCodeX' : fallback;
    });
    const broadcastUi = vi.fn();
    await dispatchGhostPromptInboundMessage(
      { type: 'suggest', text: 'abc', captureId: 99 },
      baseServices({
        suggestDeps: {
          ...minimalSuggestDeps(),
          broadcastUi,
        },
      }),
    );

    vitest.expect(handleGhostPromptSuggestMock).not.toHaveBeenCalled();
    vitest.expect(broadcastUi).not.toHaveBeenCalled();
  });

  vitest.it('ignora suggest en superficie hub', async () => {
    await dispatchGhostPromptInboundMessage(
      { type: 'suggest', text: 'x', captureId: 1 },
      baseServices({
        viewContributionId: 'ghostPrompt.inputPanel',
        surfaceRole: 'hub',
      }),
    );
    vitest.expect(handleGhostPromptSuggestMock).not.toHaveBeenCalled();
  });

  vitest.it('enruta suggest al pipeline en superficie chat', async () => {
    await dispatchGhostPromptInboundMessage(
      { type: 'suggest', text: 'hola', captureId: 42 },
      baseServices(),
    );
    vitest.expect(handleGhostPromptSuggestMock).toHaveBeenCalledWith(
      { type: 'suggest', text: 'hola', captureId: 42 },
      vitest.expect.any(Object),
    );
  });
});
