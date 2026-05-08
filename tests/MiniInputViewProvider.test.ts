import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestCompletionMock,
  appendSuggestionMock,
  appendLogMock,
  sendToChatMock,
  logSuggestionDebugMock,
  readFileSyncMock,
  MockCancellationTokenSource,
} = vi.hoisted(() => ({
  requestCompletionMock: vi.fn(),
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

vi.mock("../src/CopilotCompletion", () => ({
  requestCompletion: requestCompletionMock,
}));

vi.mock("../src/SuggestionLog", () => ({
  appendSuggestion: appendSuggestionMock,
}));

vi.mock("../src/ConversationLog", () => ({
  append: appendLogMock,
}));

vi.mock("../src/ChatBridge", () => ({
  sendToChat: sendToChatMock,
}));

vi.mock("../src/SuggestionDebug", () => ({
  logSuggestionDebug: logSuggestionDebugMock,
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

import { MiniInputViewProvider } from "../src/MiniInputViewProvider";

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
  });

  it("publica loading y suggestion cuando requestCompletion responde sugerencia", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider({
      extensionUri: { fsPath: "/ext" },
      storageUri: { fsPath: "/storage" },
      globalStorageUri: { fsPath: "/global" },
    } as never);

    requestCompletionMock.mockResolvedValueOnce({
      kind: "suggestion",
      suggestion: "continuacion",
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "suggest", text: "hola", captureId: 1 });

    expect(postMessageMock).toHaveBeenNthCalledWith(1, {
      type: "loading",
      captureId: 1,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "suggestion",
      suggestion: "continuacion",
      captureId: 1,
    });
  });

  it("publica empty cuando requestCompletion no encuentra sugerencia", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider({
      extensionUri: { fsPath: "/ext" },
      storageUri: { fsPath: "/storage" },
      globalStorageUri: { fsPath: "/global" },
    } as never);

    requestCompletionMock.mockResolvedValueOnce({
      kind: "empty",
      reason: "no-model",
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);
    await suggestHandler?.({ type: "suggest", text: "texto distinto", captureId: 2 });

    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "empty",
      reason: "no-model",
      captureId: 2,
    });
  });

  it("bloquea input demasiado corto y se recupera en siguiente suggest valido", async () => {
    const view = createView();
    const provider = new MiniInputViewProvider({
      extensionUri: { fsPath: "/ext" },
      storageUri: { fsPath: "/storage" },
      globalStorageUri: { fsPath: "/global" },
    } as never);

    requestCompletionMock.mockResolvedValueOnce({
      kind: "suggestion",
      suggestion: "continuacion valida",
    });

    provider.resolveWebviewView(view as never, {} as never, {} as never);

    await suggestHandler?.({ type: "suggest", text: " ", captureId: 3 });
    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: "empty",
      reason: "too-short",
      captureId: 3,
    });
    expect(requestCompletionMock).not.toHaveBeenCalled();

    await suggestHandler?.({ type: "suggest", text: "hola mundo", captureId: 4 });
    expect(postMessageMock).toHaveBeenNthCalledWith(2, {
      type: "loading",
      captureId: 4,
    });
    expect(postMessageMock).toHaveBeenNthCalledWith(3, {
      type: "suggestion",
      suggestion: "continuacion valida",
      captureId: 4,
    });
    expect(requestCompletionMock).toHaveBeenCalledOnce();
  });
});
