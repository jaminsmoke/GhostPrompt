import { beforeEach, describe, expect, it, vi } from "vitest";

type TestSuggestionModel = import("../src/core/types").SuggestionModelDescriptor;

const {
  requestCompletionMock,
  resolveSuggestionLanguageMock,
  listSuggestionModelsMock,
  appendSuggestionMock,
  appendLogMock,
  sendToChatMock,
  logSuggestionDebugMock,
  readFileSyncMock,
  cancellationTokenSourceMock,
} = vi.hoisted(() => {
  class CancellationTokenSourceMock {
    public token = { isCancellationRequested: false };
    public cancel(): void {
      this.token.isCancellationRequested = true;
    }
    public dispose(): void {}
  }
  return {
    requestCompletionMock: vi.fn(),
    resolveSuggestionLanguageMock: vi.fn(() => "en"),
    listSuggestionModelsMock: vi.fn(
      async (): Promise<TestSuggestionModel[]> => [],
    ),
    appendSuggestionMock: vi.fn(),
    appendLogMock: vi.fn(),
    sendToChatMock: vi.fn(),
    logSuggestionDebugMock: vi.fn(),
    readFileSyncMock: vi.fn(
      () => "<html>{{nonce}} {{cspSource}} {{styleUri}} {{scriptUri}}</html>",
    ),
    cancellationTokenSourceMock: CancellationTokenSourceMock,
  };
});

let suggestHandler: ((message: unknown) => void | Promise<void>) | undefined;
const postMessageMock = vi.fn();

vi.mock("fs", () => ({
  readFileSync: readFileSyncMock,
  existsSync: vi.fn(() => true),
}));

vi.mock("../src/engines/engineRegistry", () => ({
  getCompletionProviderForSource: () => ({
    id: "copilotLm",
    requestCompletion: requestCompletionMock,
  }),
  getCompletionProviderKind: () => "copilot" as const,
}));

vi.mock("../src/core/sources", () => ({
  getEnabledCompletionSources: () => ["copilot"],
  resolveCompletionSourceForRequest: () => "copilot" as const,
  getCompletionUiKind: () => "copilot" as const,
  looksLikeOpencodeModelId: () => false,
  looksLikeOllamaModelId: () => false,
}));

vi.mock("../src/core/language", () => ({
  resolveSuggestionLanguage: resolveSuggestionLanguageMock,
}));

vi.mock("../src/core/catalog/mergedModelCatalog", () => ({
  listMergedSuggestionModels: listSuggestionModelsMock,
}));

vi.mock("../src/engines/copilot/catalog/modelCatalog", () => ({
  listSuggestionModels: listSuggestionModelsMock,
}));

vi.mock("../src/engines/opencode/catalog/opencodeModelCatalog", () => ({
  listOpencodeSuggestionModels: vi.fn(async () => []),
}));

vi.mock("../src/engines/ollama/catalog/ollamaModelCatalog", () => ({
  listOllamaSuggestionModels: vi.fn(async () => []),
}));

vi.mock("../src/api/protocols/inboundHandlers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/protocols/inboundHandlers")>();
  return {
    ...actual,
    dispatchGhostPromptInboundMessage: vi.fn(async (message: unknown, services: unknown) => {
      if (typeof message === "object" && message !== null && "type" in message && (message as { type: string }).type === "suggest") {
        const { handleGhostPromptSuggest } = await import("../src/core/pipeline");
        const deps = (services as { suggestDeps: unknown }).suggestDeps;
        return handleGhostPromptSuggest(message as never, deps as never);
      }
      return actual.dispatchGhostPromptInboundMessage(message as never, services as never);
    }),
  };
});

vi.mock("../src/api/protocols/webviewProtocols", () => ({
  parseWebviewInboundMessage: (raw: unknown) => {
    if (
      typeof raw === "object" &&
      raw !== null &&
      "type" in raw &&
      typeof (raw as { type: unknown }).type === "string"
    ) {
      const msg = raw as Record<string, unknown>;
      if (msg.type === "suggest" && (typeof msg.captureId !== "number" || typeof msg.text !== "string")) {
        return undefined;
      }
      return raw;
    }
    return undefined;
  },
}));

vi.mock("../src/api/settings/settingsPostMessage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/settings/settingsPostMessage")>();
  return {
    ...actual,
    buildAndPostGhostPromptSettings: vi.fn(async (webview: { postMessage: (m: unknown) => void }, getters: unknown) => {
      const models = await listSuggestionModelsMock();
      webview.postMessage({
        type: "settings",
        settings: {
          completionProvider: "copilot",
          completionUiKind: "copilot",
          enabledCompletionSources: ["copilot"],
          suggestionModelPolicy: "nonPremiumOnly",
          selectedModelId: "auto",
          availableModels: models,
          suggestionStyle: "balanced",
          contextMode: "basic",
          suggestionLanguageChoice: "auto",
          effectiveSuggestionLanguage: "en",
          effectiveModel: undefined,
          debugSuggestions: false,
          suggestionDebounceMs: 800,
          agentDestination: "copilotChat",
          vsOpenCodeXExtensionInstalled: false,
        },
      });
    }),
  };
});

vi.mock("../src/api/getters/workspaceGetters", () => ({
  collectGhostPromptProjectContext: () => ({}),
  getGhostPromptContextMode: () => "basic",
  getGhostPromptMaxSuggestionChars: () => 180,
  getGhostPromptProjectMemoryEnabled: () => true,
  getGhostPromptSelectedModelId: () => "auto",
  getGhostPromptSuggestionLanguage: () => "en",
  getGhostPromptSuggestionLanguageChoice: () => "auto",
  getGhostPromptSuggestionLanguageMode: () => "auto",
  getGhostPromptSuggestionModelPolicy: () => "nonPremiumOnly",
  getGhostPromptSuggestionStyle: () => "balanced",
  getGhostPromptAgentDestination: () => "copilotChat",
  isVsOpenCodeXExtensionInstalled: () => false,
  getGhostPromptOllamaBaseUrl: () => "http://localhost:11434",
  getGhostPromptOllamaExcludedModelIds: () => [],
}));

vi.mock("../src/system/log/SuggestionLog", () => ({
  appendSuggestion: appendSuggestionMock,
}));

vi.mock("../src/system/log/ConversationLog", () => ({
  append: appendLogMock,
}));

vi.mock("../src/destinations/copilotChat/copilotChatDestination", () => ({
  sendToChat: sendToChatMock,
}));

vi.mock("../src/system/debug/SuggestionDebug", () => ({
  logSuggestionDebug: logSuggestionDebugMock,
  isSuggestionDebugEnabled: () => false,
}));

/* eslint-disable @typescript-eslint/naming-convention -- mock del módulo `vscode` (API PascalCase) */
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => {
        if (key === "suggestionModelPolicy") {
          return "nonPremiumOnly";
        }
        if (key === "minCharsForSuggestion") {
          return 1;
        }
        if (key === "maxSuggestionChars") {
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
  Uri: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
  CancellationTokenSource: cancellationTokenSourceMock,
}));
/* eslint-enable @typescript-eslint/naming-convention */

import { suggestionLoadingStatusText } from "../src/core/loading";
import { ghostPromptSessionStore } from "../src/core/session/GhostPromptSessionStore";
import { MiniInputViewProvider } from "../src/ui/provider/MiniInputViewProvider";

function createView() {
  suggestHandler = undefined;
  postMessageMock.mockReset();

  return {
    webview: {
      cspSource: "csp-source",
      options: {},
      html: "",
      asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview://${uri.fsPath}` }),
      onDidReceiveMessage: (handler: (message: unknown) => void | Promise<void>) => {
        suggestHandler = handler;
      },
      postMessage: postMessageMock,
    },
  };
}

describe("MiniInputViewProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ghostPromptSessionStore.resetSessionState();
    MiniInputViewProvider.clearWebviewRegistrationsForTests();
  });

  it("publica loading y suggestion cuando requestCompletion responde sugerencia", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: "/ext" },
        storageUri: { fsPath: "/storage" },
        globalStorageUri: { fsPath: "/global" },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: "suggestion",
      suggestion: "continuacion",
      model: { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" },
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "suggest", text: "hola", captureId: 1 });

    expect(postMessageMock).toHaveBeenNthCalledWith(1, {
      type: "loading",
      captureId: 1,
      phase: "copilot",
      statusText: suggestionLoadingStatusText("copilot"),
      broadcast: true,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "languageEffective",
      language: "en",
      broadcast: true,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: "suggestion",
      suggestion: "continuacion",
      model: { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" },
      captureId: 1,
      broadcast: true,
    });
  });

  it("publica empty cuando requestCompletion no encuentra sugerencia", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: "/ext" },
        storageUri: { fsPath: "/storage" },
        globalStorageUri: { fsPath: "/global" },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: "empty",
      reason: "no-model",
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "suggest", text: "texto distinto", captureId: 2 });

    expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: "empty",
      reason: "no-model",
      captureId: 2,
      broadcast: true,
    });
  });

  it("bloquea input demasiado corto y se recupera en siguiente suggest valido", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: "/ext" },
        storageUri: { fsPath: "/storage" },
        globalStorageUri: { fsPath: "/global" },
      } as never,
      MiniInputViewProvider.viewId,
    );

    requestCompletionMock.mockResolvedValueOnce({
      kind: "suggestion",
      suggestion: "continuacion valida",
      model: { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" },
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);

    await suggestHandler?.({ type: "suggest", text: " ", captureId: 3 });
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "empty",
      reason: "too-short",
      captureId: 3,
      broadcast: true,
    });
    expect(requestCompletionMock).not.toHaveBeenCalled();

    await suggestHandler?.({ type: "suggest", text: "hola mundo", captureId: 4 });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "loading",
      captureId: 4,
      phase: "copilot",
      statusText: suggestionLoadingStatusText("copilot"),
      broadcast: true,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: "languageEffective",
      language: "en",
      broadcast: true,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(4, {
      type: "suggestion",
      suggestion: "continuacion valida",
      model: { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" },
      captureId: 4,
      broadcast: true,
    });
    expect(requestCompletionMock).toHaveBeenCalledOnce();
  });

  it("ignora mensajes entrantes que no pasan el contrato Zod", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: "/ext" },
        storageUri: { fsPath: "/storage" },
        globalStorageUri: { fsPath: "/global" },
      } as never,
      MiniInputViewProvider.viewId,
    );
    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({
      type: "suggest",
      text: "hola",
      captureId: "1",
    } as never);
    expect(requestCompletionMock).not.toHaveBeenCalled();
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it("refreshSettingsAllViews envía settings a todas las vistas registradas (D1)", async () => {
    const postA = vi.fn();
    const postB = vi.fn();
    const ctx = {
      extensionUri: { fsPath: "/ext" },
      storageUri: { fsPath: "/storage" },
      globalStorageUri: { fsPath: "/global" },
    } as never;
    const webviewShell = {
      cspSource: "csp-source",
      options: {},
      html: "",
      asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview://${uri.fsPath}` }),
      onDidReceiveMessage: () => {},
    };
    const viewA = { webview: { ...webviewShell, postMessage: postA } };
    const viewB = { webview: { ...webviewShell, postMessage: postB } };

    const providerA = new MiniInputViewProvider(ctx, MiniInputViewProvider.viewId);
    const providerB = new MiniInputViewProvider(ctx, MiniInputViewProvider.panelViewId);
    providerA.resolveWebviewView(viewA as never, {} as never, {} as never);
    providerB.resolveWebviewView(viewB as never, {} as never, {} as never);

    await MiniInputViewProvider.refreshSettingsAllViews();

    expect(postA).toHaveBeenCalledWith(expect.objectContaining({ type: "settings" }));
    expect(postB).toHaveBeenCalledWith(expect.objectContaining({ type: "settings" }));
  });

  it("publica metadata de modelo en settings iniciales", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider(
      {
        extensionUri: { fsPath: "/ext" },
        storageUri: { fsPath: "/storage" },
        globalStorageUri: { fsPath: "/global" },
      } as never,
      MiniInputViewProvider.viewId,
    );

    listSuggestionModelsMock.mockResolvedValueOnce([
      {
        id: "gpt-4o-mini",
        label: "GPT-4o mini",
        tier: "included",
        completionSource: "copilot",
      },
    ]);

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "init" });

    expect(postMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "settings",
        settings: expect.objectContaining({
          completionUiKind: "copilot",
          enabledCompletionSources: ["copilot"],
          suggestionDebounceMs: 800,
          availableModels: [
            {
              id: "gpt-4o-mini",
              label: "GPT-4o mini",
              tier: "included",
              completionSource: "copilot",
            },
          ],
        }),
      }),
    );
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "draftHydrate",
      text: "",
    });
  });
});
