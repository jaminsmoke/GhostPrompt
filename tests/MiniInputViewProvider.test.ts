import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestCompletionMock,
  resolveSuggestionLanguageMock,
  listSuggestionModelsMock,
  appendSuggestionMock,
  appendLogMock,
  sendToChatMock,
  logSuggestionDebugMock,
  readFileSyncMock,
  MockCancellationTokenSource,
} = vi.hoisted(() => ({
  requestCompletionMock: vi.fn(),
  resolveSuggestionLanguageMock: vi.fn(() => "en"),
  listSuggestionModelsMock: vi.fn(async () => []),
  appendSuggestionMock: vi.fn(),
  appendLogMock: vi.fn(),
  sendToChatMock: vi.fn(),
  logSuggestionDebugMock: vi.fn(),
  readFileSyncMock: vi.fn(
    () => "<html>{{nonce}} {{cspSource}} {{styleUri}} {{scriptUri}}</html>",
  ),
  MockCancellationTokenSource: class {
    public token = { isCancellationRequested: false };
    public cancel(): void {
      this.token.isCancellationRequested = true;
    }
    public dispose(): void {}
  },
}));

let suggestHandler: ((message: unknown) => void | Promise<void>) | undefined;
const postMessageMock = vi.fn();

vi.mock("fs", () => ({
  readFileSync: readFileSyncMock,
}));

vi.mock("../src/completion/CopilotCompletion", () => ({
  requestCompletion: requestCompletionMock,
  resolveSuggestionLanguage: resolveSuggestionLanguageMock,
  listSuggestionModels: listSuggestionModelsMock,
}));

vi.mock("../src/log/SuggestionLog", () => ({
  appendSuggestion: appendSuggestionMock,
}));

vi.mock("../src/log/ConversationLog", () => ({
  append: appendLogMock,
}));

vi.mock("../src/bridge/ChatBridge", () => ({
  sendToChat: sendToChatMock,
}));

vi.mock("../src/debug/SuggestionDebug", () => ({
  logSuggestionDebug: logSuggestionDebugMock,
  isSuggestionDebugEnabled: () => false,
}));

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
    }),
  },
  Uri: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
  CancellationTokenSource: MockCancellationTokenSource,
}));

import { ghostPromptSessionStore } from "../src/session/GhostPromptSessionStore";
import { MiniInputViewProvider } from "../src/host/MiniInputViewProvider";

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
      { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" },
    ]);

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "init" });

    expect(postMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "settings",
        settings: expect.objectContaining({
          availableModels: [{ id: "gpt-4o-mini", label: "GPT-4o mini", tier: "included" }],
        }),
      }),
    );
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "draftHydrate",
      text: "",
    });
  });
});
