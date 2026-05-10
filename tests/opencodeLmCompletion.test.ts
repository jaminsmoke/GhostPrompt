import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => false),
      inspect: vi.fn(() => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
    }),
  },
}));

const { mockStart, mockGetClient, mockLogDebugFirstPrompt, mockGetOpenCodeRuntime } =
  vi.hoisted(() => {
    const mockStart = vi.fn();
    const mockGetClient = vi.fn();
    const mockLogDebugFirstPrompt = vi.fn();
    const mockGetOpenCodeRuntime = vi.fn(() => ({
      start: mockStart,
      getClient: mockGetClient,
      isRunning: false,
      logDebugFirstPrompt: mockLogDebugFirstPrompt,
    }));
    return {
      mockStart,
      mockGetClient,
      mockLogDebugFirstPrompt,
      mockGetOpenCodeRuntime,
    };
  });

vi.mock("../src/opencode/OpenCodeRuntime", () => ({
  getOpenCodeRuntime: mockGetOpenCodeRuntime,
}));

import { requestOpencodeCompletion } from "../src/completion/providers/opencodeLmCompletion";

function makeToken() {
  const listeners: Array<() => void> = [];
  return {
    isCancellationRequested: false,
    onCancellationRequested: (cb: () => void) => {
      listeners.push(cb);
      return { dispose: () => {} };
    },
    cancel: () => {
      listeners.forEach((l) => l());
    },
  };
}

describe("requestOpencodeCompletion", () => {
  const session = {
    create: vi.fn(),
    prompt: vi.fn(),
    delete: vi.fn(),
    abort: vi.fn(),
  };

  beforeEach(() => {
    mockStart.mockReset();
    mockGetClient.mockReset();
    mockLogDebugFirstPrompt.mockReset();
    session.create.mockReset();
    session.prompt.mockReset();
    session.delete.mockReset();
    session.abort.mockReset();

    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
          data: {
            providers: [
              {
                id: "anthropic",
                name: "Anthropic",
                models: {
                  m1: { id: "claude-3", name: "Claude 3" },
                },
              },
            ],
            default: { anthropic: "claude-3" },
          },
        }),
      },
      session,
    });

    session.create.mockResolvedValue({
      data: { id: "sess-1" },
    });
    session.prompt.mockResolvedValue({
      data: {
        info: {},
        parts: [{ type: "text", text: " suggested continuation" }],
      },
    });
    session.delete.mockResolvedValue({ data: true });
  });

  it("returns suggestion when prompt succeeds", async () => {
    const token = makeToken();
    const result = await requestOpencodeCompletion(
      "Write a greeting for the team meeting.",
      {
        token: token as unknown as import("vscode").CancellationToken,
        policy: "anyModel",
        preferredModelId: "anthropic/claude-3",
        maxSuggestionChars: 180,
        style: "balanced",
      },
    );

    expect(result.kind).toBe("suggestion");
    if (result.kind === "suggestion") {
      expect(result.suggestion.length).toBeGreaterThan(0);
      expect(result.model?.id).toBe("anthropic/claude-3");
    }
    expect(session.create).toHaveBeenCalled();
    expect(session.prompt).toHaveBeenCalled();
    expect(session.delete).toHaveBeenCalled();
  });

  it("returns error when runtime fails to start", async () => {
    mockStart.mockResolvedValue({ ok: false, error: "CLI missing" });
    const token = makeToken();
    const result = await requestOpencodeCompletion("hello world test phrase here", {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "anyModel",
    });
    expect(result).toEqual({ kind: "error", message: "CLI missing" });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("returns empty no-model when catalog has no models", async () => {
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
          data: { providers: [], default: {} },
        }),
      },
      session,
    });

    const token = makeToken();
    const result = await requestOpencodeCompletion("hello world test phrase here", {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "anyModel",
      preferredModelId: "auto",
    });

    expect(result).toEqual({ kind: "empty", reason: "no-model" });
  });

  it("returns error when prompt envelope carries error", async () => {
    session.prompt.mockResolvedValue({
      error: { message: "Prompt rejected" },
    });

    const token = makeToken();
    const result = await requestOpencodeCompletion("hello world test phrase here", {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "anyModel",
      preferredModelId: "anthropic/claude-3",
    });

    expect(result).toEqual({ kind: "error", message: "Prompt rejected" });
  });

  it("nonPremiumOnly rejects explicit premium model", async () => {
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
          data: {
            providers: [
              {
                id: "openai",
                name: "OpenAI",
                models: {
                  m1: { id: "gpt-4", name: "GPT-4", pricing: "1x" },
                },
              },
            ],
            default: {},
          },
        }),
      },
      session,
    });
    const token = makeToken();
    const result = await requestOpencodeCompletion("hello world test phrase here", {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "nonPremiumOnly",
      preferredModelId: "openai/gpt-4",
    });
    expect(result).toEqual({ kind: "empty", reason: "no-included-model" });
    expect(session.prompt).not.toHaveBeenCalled();
  });

  it("returns empty request-timeout when assistant reports abort-like error", async () => {
    session.prompt.mockResolvedValue({
      data: {
        info: {
          error: { name: "MessageAbortedError", data: { message: "aborted" } },
        },
        parts: [],
      },
    });

    const token = makeToken();
    const result = await requestOpencodeCompletion("hello world test phrase here", {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "anyModel",
      preferredModelId: "anthropic/claude-3",
    });

    expect(result).toEqual({ kind: "empty", reason: "request-timeout" });
  });
});
