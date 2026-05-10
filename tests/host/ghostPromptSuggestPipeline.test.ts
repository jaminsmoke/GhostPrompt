import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  CancellationTokenSource: class {
    public token = { isCancellationRequested: false };
    cancel(): void {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
  },
}));

import * as completion from "../../src/completion";
import {
  runGhostPromptSuggestPipeline,
  type GhostPromptSuggestDeps,
} from "../../src/host/ghostPromptSuggestPipeline";
import { ghostPromptSessionStore } from "../../src/session/GhostPromptSessionStore";

function minimalDeps(): GhostPromptSuggestDeps {
  return {
    broadcastUi: vi.fn(),
    getSuggestionModelPolicy: () => "nonPremiumOnly",
    getSelectedModelId: () => "auto",
    getSuggestionStyle: () => "balanced",
    getContextMode: () => "basic",
    getSuggestionLanguageMode: () => "auto",
    getSuggestionLanguage: () => "en",
    getMaxSuggestionChars: () => 180,
    collectProjectContext: () => ({}),
  };
}

describe("runGhostPromptSuggestPipeline", () => {
  const requestCompletion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.spyOn(completion, "getCompletionProviderForSource").mockReturnValue({
      id: "copilotLm",
      requestCompletion,
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
  });

  it("tras decisión request llama al proveedor y emite suggestion", async () => {
    const deps = minimalDeps();
    const text = "hello world pipeline test phrase here";
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
});
