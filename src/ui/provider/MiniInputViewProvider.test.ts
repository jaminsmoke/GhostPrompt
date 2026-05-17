/**
 * @file Tests del MiniInputViewProvider y del webview GhostPrompt.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

import { suggestionLoadingStatusText } from '../../system/internals/protocols/state/loading';
import { resetGhostPromptHostRuntimeForTests } from '../../system/runtime/resetHostRuntimeForTests';

import { MiniInputViewProvider } from './MiniInputViewProvider';

import type * as InboundHandlersModule from '../../api/protocols/inboundHandlers';
import type * as WebviewProtocolsModule from '../../api/protocols/webviewProtocols';
import type * as SettingsPostMessageModule from '../../api/settings/settingsPostMessage';
import type { SuggestionModelDescriptor } from '../../system/internals/protocols/types';
import type * as SuggestRuntimeModule from '../../system/runtime/suggestRuntime';

type GhostPromptSuggestDeps = SuggestRuntimeModule.GhostPromptSuggestDeps;

type TestSuggestionModel = SuggestionModelDescriptor;

const {
  requestCompletionMock,
  listSuggestionModelsMock,
  sendToChatMock,
  readFileSyncMock,
  cancellationTokenSourceMock,
} = vi.hoisted(() => {
  class CancellationTokenSourceMock {
    public token = { isCancellationRequested: false };
    public cancel(): void {
      this.token.isCancellationRequested = true;
    }
    public dispose(): void { return; }
  }
  return {
    requestCompletionMock: vi.fn(),
    listSuggestionModelsMock: vi.fn((): Promise<TestSuggestionModel[]> => Promise.resolve([])),
    sendToChatMock: vi.fn(),
    readFileSyncMock: vi.fn(
      () => '<html>{{nonce}} {{cspSource}} {{styleUri}} {{scriptUri}}</html>',
    ),
    cancellationTokenSourceMock: CancellationTokenSourceMock,
  };
});

let suggestHandler: ((message: unknown) => Promise<void> | void) | undefined;
const postMessageMock = vi.fn();

vi.mock('fs', () => ({
  readFileSync: readFileSyncMock,
  existsSync: vi.fn(() => true),
}));

vi.mock('../../engines/routing/resolveProvider', () => ({
  resolveProvider: () => ({
    id: 'copilotLm',
    requestCompletion: requestCompletionMock,
  }),
}));

vi.mock('../../engines/provider/ollama/routing/routingModelId', () => ({
  looksLikeOllamaModelId: () => false,
}));

vi.mock('../../engines/provider/opencode/routingModelId', () => ({
  looksLikeOpencodeModelId: () => false,
}));

vi.mock('../../engines/config/completionSources', () => ({
  getEnabledCompletionSources: () => ['copilot'],
  getCompletionUiKind: () => 'copilot' as const,
}));

vi.mock('../../engines/provider/mergedModelCatalog', () => ({
  listMergedSuggestionModels: listSuggestionModelsMock,
}));

vi.mock('../../engines/provider/copilot/catalog/modelCatalog', () => ({
  listSuggestionModels: listSuggestionModelsMock,
}));

vi.mock('../../engines/provider/opencode/catalog/opencodeModelCatalog', () => ({
  listOpencodeSuggestionModels: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../engines/provider/ollama/catalog/ollamaModelCatalog', () => ({
  listOllamaSuggestionModels: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../api/protocols/inboundHandlers', async (importOriginal) => {
  const actual = await importOriginal<typeof InboundHandlersModule>();
  return {
    ...actual,
    dispatchGhostPromptInboundMessage: vi.fn(async (message: unknown, services: unknown) => {
      if (
        typeof message === 'object' &&
        'type' in message &&
        (message as { type: string }).type === 'suggest'
      ) {
        const runtime = await vi.importActual<typeof SuggestRuntimeModule>(
          '../../system/runtime/suggestRuntime',
        );
        const deps = (services as { suggestDeps: GhostPromptSuggestDeps }).suggestDeps;
        return runtime.handleGhostPromptSuggest(
          message as Parameters<typeof runtime.handleGhostPromptSuggest>[0],
          deps,
        );
      }
      return actual.dispatchGhostPromptInboundMessage(message as never, services as never);
    }),
  };
});

vi.mock('../../api/protocols/webviewProtocols', async (importOriginal) => {
  const actual = await importOriginal<typeof WebviewProtocolsModule>();
  return {
    ...actual,
    parseWebviewInboundMessage: (raw: unknown) => {
      if (
        typeof raw === 'object' &&
        'type' in raw &&
        typeof raw.type === 'string'
      ) {
        const msg = raw as Record<string, unknown>;
        if (
          msg.type === 'suggest' &&
          (typeof msg.captureId !== 'number' || typeof msg.text !== 'string')
        ) {
          return;
        }
        return raw;
      }
      
    },
  };
});

vi.mock('../../api/settings/settingsPostMessage', async (importOriginal) => {
  const actual = await importOriginal<typeof SettingsPostMessageModule>();
  return {
    ...actual,
    buildAndPostGhostPromptSettings: vi.fn(
      async (webview: { postMessage: (m: unknown) => void }, _getters: unknown) => {
        const models = await listSuggestionModelsMock();
        webview.postMessage({
          type: 'settings',
          settings: {
            completionProvider: 'copilot',
            completionUiKind: 'copilot',
            enabledCompletionSources: ['copilot'],
            suggestionModelPolicy: 'nonPremiumOnly',
            selectedModelId: 'auto',
            availableModels: models,
            suggestionStyle: 'balanced',
            effectiveModel: undefined,
            debugSuggestions: false,
            suggestionDebounceMs: 800,
            agentDestination: 'copilotChat',
            vsOpenCodeXExtensionInstalled: false,
            cursorDesktopHost: false,
          },
        });
      },
    ),
  };
});

vi.mock('../../api/getters/workspaceGetters', () => ({
  collectGhostPromptProjectContext: () => ({}),
  getGhostPromptMaxSuggestionChars: () => 180,
  getGhostPromptSelectedModelId: () => 'auto',
  getGhostPromptSuggestionStyle: () => 'balanced',
  getAgentDestination: () => 'copilotChat',
  isVsOpenCodeXExtensionInstalled: () => false,
  getGhostPromptOllamaBaseUrl: () => 'http://localhost:11434',
  getGhostPromptOllamaExcludedModelIds: () => [],
}));

vi.mock('../../system/internals/config/readGhostPromptSuggestionModelPolicy', () => ({
  readGhostPromptSuggestionModelPolicy: () => 'nonPremiumOnly',
}));

vi.mock('../../destinations/copilotChat/copilotChatDestination', () => ({
  sendToChat: sendToChatMock,
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => {
        if (key === 'suggestionModelPolicy') {
          return 'nonPremiumOnly';
        }
        if (key === 'minCharsForSuggestion') {
          return 1;
        }
        if (key === 'maxSuggestionChars') {
          return 180;
        }
        return fallback;
      },
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
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
  'CancellationTokenSource': cancellationTokenSourceMock,
}));

/**
 * Creates a mocked MiniInputViewProvider webview view for tests.
 * @returns {{ webview: { cspSource: string; options: object; html: string; asWebviewUri: (uri: { fsPath: string }) => { toString(): string }; onDidReceiveMessage: (handler: (message: unknown) => void | Promise<void>) => void; postMessage: typeof postMessageMock } }} A test view object with a mock webview.
 */
function createView() {
  suggestHandler = undefined;
  postMessageMock.mockReset();

  return {
    webview: {
      cspSource: 'csp-source',
      options: {},
      html: '',
      asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview://${uri.fsPath}` }),
      onDidReceiveMessage: (handler: (message: unknown) => Promise<void> | void) => {
        suggestHandler = handler;
      },
      postMessage: postMessageMock,
    },
  };
}

vitest.describe('MiniInputViewProvider', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
    resetGhostPromptHostRuntimeForTests();
    MiniInputViewProvider.clearWebviewRegistrationsForTests();
  });

  vitest.it('publica loading y suggestion cuando requestCompletion responde sugerencia', async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: '/ext' },
        storageUri: { fsPath: '/storage' },
        globalStorageUri: { fsPath: '/global' },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: 'suggestion',
      suggestion: 'continuacion',
      model: { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'included' },
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: 'suggest', text: 'hola', captureId: 1 });

    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'loading',
      captureId: 1,
      phase: 'copilot',
      statusText: suggestionLoadingStatusText('copilot'),
      broadcast: true,
    });
    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'suggestion',
      suggestion: 'continuacion',
      model: { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'included' },
      captureId: 1,
      broadcast: true,
    });
  });

  vitest.it('publica empty cuando requestCompletion no encuentra sugerencia', async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: '/ext' },
        storageUri: { fsPath: '/storage' },
        globalStorageUri: { fsPath: '/global' },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: 'empty',
      reason: 'no-model',
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: 'suggest', text: 'texto distinto', captureId: 2 });

    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'empty',
      reason: 'no-model',
      captureId: 2,
      broadcast: true,
    });
  });

  vitest.it('bloquea input demasiado corto y se recupera en siguiente suggest valido', async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: '/ext' },
        storageUri: { fsPath: '/storage' },
        globalStorageUri: { fsPath: '/global' },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: 'suggestion',
      suggestion: 'continuacion valida',
      model: { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'included' },
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);

    await suggestHandler?.({ type: 'suggest', text: ' ', captureId: 3 });
    vitest.expect(postMessageMock).toHaveBeenLastCalledWith({
      type: 'empty',
      reason: 'too-short',
      captureId: 3,
      broadcast: true,
    });
    vitest.expect(requestCompletionMock).not.toHaveBeenCalled();

    await suggestHandler?.({ type: 'suggest', text: 'hola mundo', captureId: 4 });
    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'loading',
      captureId: 4,
      phase: 'copilot',
      statusText: suggestionLoadingStatusText('copilot'),
      broadcast: true,
    });
    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'suggestion',
      suggestion: 'continuacion valida',
      model: { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'included' },
      captureId: 4,
      broadcast: true,
    });
    vitest.expect(requestCompletionMock).toHaveBeenCalledOnce();
  });

  vitest.it('ignora mensajes entrantes que no pasan el contrato Zod', async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: '/ext' },
        storageUri: { fsPath: '/storage' },
        globalStorageUri: { fsPath: '/global' },
      } as never,
      MiniInputViewProvider.viewId,
    );
    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({
      type: 'suggest',
      text: 'hola',
      captureId: '1',
    });
    vitest.expect(requestCompletionMock).not.toHaveBeenCalled();
    vitest.expect(postMessageMock).not.toHaveBeenCalled();
  });

  vitest.it('refreshSettingsAllViews envía settings a todas las vistas registradas (D1)', async () => {
    const postA = vi.fn();
    const postB = vi.fn();
    const ctx = {
      extensionUri: { fsPath: '/ext' },
      storageUri: { fsPath: '/storage' },
      globalStorageUri: { fsPath: '/global' },
    } as never;
    const webviewShell = {
      cspSource: 'csp-source',
      options: {},
      html: '',
      asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview://${uri.fsPath}` }),
      onDidReceiveMessage: () => { return; },
    };
    const viewA = { webview: { ...webviewShell, postMessage: postA } };
    const viewB = { webview: { ...webviewShell, postMessage: postB } };

    const providerA = new MiniInputViewProvider(ctx, MiniInputViewProvider.viewId);
    const providerB = new MiniInputViewProvider(ctx, MiniInputViewProvider.panelViewId);
    providerA.resolveWebviewView(viewA as never, {} as never, {} as never);
    providerB.resolveWebviewView(viewB as never, {} as never, {} as never);

    await MiniInputViewProvider.refreshSettingsAllViews();

    vitest.expect(postA).toHaveBeenCalledWith(vitest.expect.objectContaining({ type: 'settings' }));
    vitest.expect(postB).toHaveBeenCalledWith(vitest.expect.objectContaining({ type: 'settings' }));
  });

  vitest.it('publica metadata de modelo en settings iniciales', async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: '/ext' },
        storageUri: { fsPath: '/storage' },
        globalStorageUri: { fsPath: '/global' },
      } as never,
      MiniInputViewProvider.viewId,
    );

    listSuggestionModelsMock.mockResolvedValueOnce([
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        tier: 'included',
        completionSource: 'copilot',
      },
    ]);

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: 'init' });

    const firstPost = postMessageMock.mock.calls[0]?.[0] as {
      type: string;
      settings: {
        completionUiKind: string;
        enabledCompletionSources: string[];
        suggestionDebounceMs: number;
        availableModels: { id: string; label: string; tier: string; completionSource: string }[];
      };
    };
    vitest.expect(firstPost.type).toBe('settings');
    vitest.expect(firstPost.settings.completionUiKind).toBe('copilot');
    vitest.expect(firstPost.settings.enabledCompletionSources).toEqual(['copilot']);
    vitest.expect(firstPost.settings.suggestionDebounceMs).toBe(800);
    vitest.expect(firstPost.settings.availableModels).toEqual([
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        tier: 'included',
        completionSource: 'copilot',
      },
    ]);
    vitest.expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'draftHydrate',
      text: '',
    });
  });
});
