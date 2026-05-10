import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const inspectMock = vi.hoisted(() =>
  vi.fn(() => ({
    globalValue: undefined as unknown,
    workspaceValue: undefined as unknown,
    workspaceFolderValue: undefined as unknown,
  })),
);

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: getMock,
      inspect: inspectMock,
    }),
  },
}));

import {
  getCompletionUiKind,
  getEnabledCompletionSources,
  looksLikeOpencodeModelId,
  resolveCompletionSourceForRequest,
} from "../src/completion/completionSources";

describe("completionSources", () => {
  beforeEach(() => {
    getMock.mockReset();
    inspectMock.mockImplementation(() => ({
      globalValue: undefined,
      workspaceValue: undefined,
      workspaceFolderValue: undefined,
    }));
  });

  it("usa completionProvider legacy cuando enabledCompletionSources no está definido", () => {
    getMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "completionProvider") {
        return "opencode";
      }
      return defaultValue;
    });
    expect(getEnabledCompletionSources()).toEqual(["opencode"]);
    expect(getCompletionUiKind()).toBe("opencode");
  });

  it("respeta enabledCompletionSources cuando existe en configuración", () => {
    inspectMock.mockImplementation(() => ({
      globalValue: ["copilot", "opencode"],
      workspaceValue: undefined,
      workspaceFolderValue: undefined,
    }));
    getMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "enabledCompletionSources") {
        return ["copilot", "opencode"];
      }
      return defaultValue;
    });
    expect(getEnabledCompletionSources()).toEqual(["copilot", "opencode"]);
    expect(getCompletionUiKind()).toBe("multi");
  });

  it("resolveCompletionSourceForRequest enruta ids OpenCode", () => {
    expect(
      resolveCompletionSourceForRequest("anthropic/claude-3", ["copilot", "opencode"]),
    ).toBe("opencode");
    expect(resolveCompletionSourceForRequest("gpt-4o-mini", ["copilot", "opencode"])).toBe(
      "copilot",
    );
    expect(resolveCompletionSourceForRequest("auto", ["copilot", "opencode"])).toBe("copilot");
  });

  it("looksLikeOpencodeModelId", () => {
    expect(looksLikeOpencodeModelId("foo/bar")).toBe(true);
    expect(looksLikeOpencodeModelId("gpt-4o-mini")).toBe(false);
  });
});
