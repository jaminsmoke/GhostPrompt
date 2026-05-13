import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => undefined),
      inspect: vi.fn(() => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
    }),
  },
}));

import {
  getActiveCompletionProvider,
  getCompletionProviderForSource,
} from "../src/engines/engineRegistry";

describe("engineRegistry", () => {
  it("getCompletionProviderForSource returns ollama provider with id ollama", () => {
    const provider = getCompletionProviderForSource("ollama");
    expect(provider.id).toBe("ollama");
    expect(provider.requestCompletion).toBeDefined();
  });

  it("getCompletionProviderForSource returns copilotLm for copilot", () => {
    const provider = getCompletionProviderForSource("copilot");
    expect(provider.id).toBe("copilotLm");
  });

  it("getCompletionProviderForSource returns opencode for opencode", () => {
    const provider = getCompletionProviderForSource("opencode");
    expect(provider.id).toBe("opencode");
  });

  it("getCompletionProviderForSource defaults to copilotLm for unknown source", () => {
    const provider = getCompletionProviderForSource("unknown" as any);
    expect(provider.id).toBe("copilotLm");
  });

  it("getActiveCompletionProvider returns copilotLm when no sources configured", () => {
    const provider = getActiveCompletionProvider();
    expect(provider.id).toBe("copilotLm");
  });
});
