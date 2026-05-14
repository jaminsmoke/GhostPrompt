import { beforeEach, describe, expect, it, vi } from "vitest";

const { showWarningMessageMock, wsConfigGetMock } = vi.hoisted(() => ({
  showWarningMessageMock: vi.fn(),
  wsConfigGetMock: vi.fn((key: string, fallback: unknown) => fallback),
}));

vi.mock("vscode", () => ({
  CancellationTokenSource: class {
    public token = { isCancellationRequested: false };
    cancel(): void {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
  Uri: {
    file: (p: string) => ({ scheme: "file", fsPath: p, path: p, toString: () => `file://${p}` }),
  },
  workspace: {
    getConfiguration: () => ({
      get: wsConfigGetMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
    showWarningMessage: showWarningMessageMock,
  },
}));

import * as vscode from "vscode";

import {
  runGhostPromptSuggestPipeline,
  type GhostPromptSuggestDeps,
} from "../../src/core/pipeline/suggestPipeline";
import { resolveCompletionSourceForRequest } from "../../src/core/sources";
import { resetSuggestionHostNotificationThrottleForTests } from "../../src/ui/notifications/suggestionNotification";
import { ghostPromptSessionStore } from "../../src/core/session/GhostPromptSessionStore";

const requestCompletion = vi.fn();

vi.mock("../../src/engines/engineRegistry", () => ({
  getCompletionProviderForSource: () => ({
    id: "copilotLm",
    requestCompletion,
  }),
  getCompletionProviderKind: () => "copilot" as const,
}));

vi.mock("../../src/core/sources", () => ({
  getEnabledCompletionSources: () => ["copilot"] as const,
  resolveCompletionSourceForRequest: vi.fn(() => "copilot" as const),
  getCompletionUiKind: () => "copilot" as const,
}));

function minimalDeps(overrides?: Partial<GhostPromptSuggestDeps>): GhostPromptSuggestDeps {
  return {
    broadcastUi: vi.fn(),
    getSuggestionModelPolicy: () => "nonPremiumOnly",
    getSelectedModelId: () => "auto",
    getSuggestionStyle: () => "balanced",
    getMaxSuggestionChars: () => 180,
    ...overrides,
  };
}

describe("runGhostPromptSuggestPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsConfigGetMock.mockImplementation((key: string, fallback: unknown) => fallback);
    resetSuggestionHostNotificationThrottleForTests();
    ghostPromptSessionStore.resetSessionState();
    requestCompletion.mockResolvedValue({
      kind: "suggestion",
      suggestion: "mocked suggestion text",
      model: {
        id: "copilot/gpt",
        label: "GPT",
        tier: "included",
      },
    });
  });

  it("no emite UI si text está vacío", async () => {
    const deps = minimalDeps();
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text: "", captureId: 1 },
      deps,
    );
    expect(deps.broadcastUi).not.toHaveBeenCalled();
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("bloquea texto corto y emite empty (too-short) sin llamar al LM", async () => {
    const deps = minimalDeps();
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text: "ab", captureId: 2 },
      deps,
    );
    expect(requestCompletion).not.toHaveBeenCalled();
    expect(deps.broadcastUi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "empty",
        reason: "too-short",
        captureId: 2,
      }),
    );
    expect(showWarningMessageMock).not.toHaveBeenCalled();
  });

  it("tras decisión request llama al proveedor y emite suggestion", async () => {
    const deps = minimalDeps();
    const text = "hello world pipeline test phrase here unique-a";
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text, captureId: 3 },
      deps,
    );
    expect(requestCompletion).toHaveBeenCalled();
    expect(deps.broadcastUi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "suggestion",
        suggestion: "mocked suggestion text",
        captureId: 3,
      }),
    );
  });

  it("ruta OpenCode: loading inicial opencode-start y onStreamPreview en opciones", async () => {
    vi.mocked(resolveCompletionSourceForRequest).mockReturnValue("opencode");
    try {
      const deps = minimalDeps();
      const text = "long enough phrase for governor pass unique-oc";
      await runGhostPromptSuggestPipeline(
        { type: "suggest", text, captureId: 20 },
        deps,
      );
      expect(deps.broadcastUi).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "loading",
          phase: "opencode-start",
          captureId: 20,
        }),
      );
      const opts = requestCompletion.mock.calls[0]?.[1] as {
        onStreamPreview?: (s: string) => void;
      };
      expect(typeof opts?.onStreamPreview).toBe("function");
    } finally {
      vi.mocked(resolveCompletionSourceForRequest).mockReturnValue("copilot");
    }
  });

  it("resultado empty del LM emite broadcast empty con reason", async () => {
    requestCompletion.mockResolvedValue({
      kind: "empty",
      reason: "no-model",
    });
    const deps = minimalDeps();
    const text = "long enough phrase for governor pass unique-empty";
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text, captureId: 30 },
      deps,
    );
    expect(deps.broadcastUi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "empty",
        reason: "no-model",
        captureId: 30,
      }),
    );
    expect(showWarningMessageMock).toHaveBeenCalledTimes(1);
    expect(showWarningMessageMock.mock.calls[0]?.[0]).toContain("No hay motor");
  });

  it("empty no-model repetido respeta throttle de aviso en host", async () => {
    requestCompletion.mockResolvedValue({
      kind: "empty",
      reason: "no-model",
    });
    const deps = minimalDeps();
    const t1 = "long enough phrase governor empty dup one";
    const t2 = "long enough phrase governor empty dup two";
    await runGhostPromptSuggestPipeline({ type: "suggest", text: t1, captureId: 40 }, deps);
    await runGhostPromptSuggestPipeline({ type: "suggest", text: t2, captureId: 41 }, deps);
    expect(showWarningMessageMock).toHaveBeenCalledTimes(1);
  });

  it("resultado error del LM emite broadcast error", async () => {
    requestCompletion.mockResolvedValue({
      kind: "error",
      message: "provider exploded",
    });
    const deps = minimalDeps();
    const text = "long enough phrase for governor pass unique-err";
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text, captureId: 31 },
      deps,
    );
    expect(deps.broadcastUi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "provider exploded",
        captureId: 31,
      }),
    );
    expect(showWarningMessageMock).not.toHaveBeenCalled();
  });

  it("error con patrón OpenCode muestra aviso en host", async () => {
    requestCompletion.mockResolvedValue({
      kind: "error",
      message: "Failed to start OpenCode server: nope",
    });
    const deps = minimalDeps();
    const text = "long enough phrase for governor pass unique-oc-err";
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text, captureId: 32 },
      deps,
    );
    expect(showWarningMessageMock).toHaveBeenCalledTimes(1);
    expect(showWarningMessageMock.mock.calls[0]?.[0]).toContain("OpenCode");
  });

  it("no muestra aviso si showSuggestionIssueNotifications está desactivado", async () => {
    wsConfigGetMock.mockImplementation((key: string, fallback: unknown) => {
      if (key === "showSuggestionIssueNotifications") {
        return false;
      }
      return fallback;
    });
    requestCompletion.mockResolvedValue({
      kind: "empty",
      reason: "no-model",
    });
    const deps = minimalDeps();
    const text = "long enough phrase for governor pass unique-notify-off";
    await runGhostPromptSuggestPipeline(
      { type: "suggest", text, captureId: 33 },
      deps,
    );
    expect(showWarningMessageMock).not.toHaveBeenCalled();
  });
});
