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
      getDeploymentId: () => 1,
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

import { requestOpencodeCompletion } from "../src/engines/opencode/opencodeLmEngine";
import { invalidateOpenCodeProvidersSnapshot } from "../src/opencode/opencodeProvidersSnapshot";
import { invalidateOpencodeInlineSuggestionSessionPool } from "../src/opencode/opencodeInlineSuggestionSession";
import { resetOpencodeInlineLmQueue } from "../src/opencode/opencodeInlineCompletionQueue";

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
    invalidateOpenCodeProvidersSnapshot();
    invalidateOpencodeInlineSuggestionSessionPool();
    resetOpencodeInlineLmQueue();
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
    expect(session.delete).not.toHaveBeenCalled();
  });

  it("calls config.providers once for two sequential suggestions (snapshot cache)", async () => {
    const providersFn = vi.fn(async () => ({
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
    }));
    mockGetClient.mockReturnValue({
      config: { providers: providersFn },
      session,
    });

    const token = makeToken();
    const opts = {
      token: token as unknown as import("vscode").CancellationToken,
      policy: "anyModel" as const,
      preferredModelId: "anthropic/claude-3",
      maxSuggestionChars: 180,
      style: "balanced" as const,
    };

    await requestOpencodeCompletion("First line for suggest.", opts);
    await requestOpencodeCompletion("Second distinct input text.", opts);

    expect(providersFn).toHaveBeenCalledTimes(1);
    expect(session.create).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent completions (never two session.prompt overlaps)", async () => {
    let concurrent = 0;
    session.prompt.mockImplementation(async () => {
      concurrent += 1;
      expect(concurrent).toBe(1);
      await new Promise((r) => setTimeout(r, 2));
      concurrent -= 1;
      return {
        data: {
          info: {},
          parts: [{ type: "text", text: " overlap-safe " }],
        },
      };
    });

    const baseOpts = {
      policy: "anyModel" as const,
      preferredModelId: "anthropic/claude-3",
      maxSuggestionChars: 180,
      style: "balanced" as const,
    };

    const results = await Promise.all([
      requestOpencodeCompletion("First concurrent overlapping phrase.", {
        ...baseOpts,
        token: makeToken() as unknown as import("vscode").CancellationToken,
      }),
      requestOpencodeCompletion("Second concurrent overlapping phrase.", {
        ...baseOpts,
        token: makeToken() as unknown as import("vscode").CancellationToken,
      }),
    ]);

    expect(results.every((r) => r.kind === "suggestion")).toBe(true);
    expect(session.prompt).toHaveBeenCalledTimes(2);
    expect(concurrent).toBe(0);
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
