import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: getMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
}));

import {
  getActiveCompletionProvider,
  getCompletionProviderKind,
} from "../src/completion/completionProvider";

describe("getActiveCompletionProvider", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns Copilot LM when completionProvider defaults", () => {
    getMock.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
    expect(getActiveCompletionProvider().id).toBe("copilotLm");
  });

  it("returns OpenCode when completionProvider is opencode", () => {
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === "completionProvider" ? "opencode" : defaultValue,
    );
    expect(getActiveCompletionProvider().id).toBe("opencode");
    expect(getCompletionProviderKind()).toBe("opencode");
  });

  it("getCompletionProviderKind tracks configuration", () => {
    getMock.mockImplementation((key: string, defaultValue: unknown) =>
      key === "completionProvider" ? "opencode" : defaultValue,
    );
    expect(getCompletionProviderKind()).toBe("opencode");
    getMock.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
    expect(getCompletionProviderKind()).toBe("copilot");
  });
});
