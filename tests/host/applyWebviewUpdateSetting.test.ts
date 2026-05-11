import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      update: (...args: unknown[]) => updateMock(...args),
    }),
  },
  ConfigurationTarget: { Global: 1 },
}));

import { applyWebviewUpdateSetting } from "../../src/host/applyWebviewUpdateSetting";

describe("applyWebviewUpdateSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persiste agentDestination en configuración global", async () => {
    const vscode = await import("vscode");
    await applyWebviewUpdateSetting({
      type: "updateSetting",
      key: "agentDestination",
      value: "vsOpenCodeX",
    });
    expect(updateMock).toHaveBeenCalledWith(
      "agentDestination",
      "vsOpenCodeX",
      vscode.ConfigurationTarget.Global,
    );
  });

  it("normaliza agentDestination a copilotChat", async () => {
    const vscode = await import("vscode");
    await applyWebviewUpdateSetting({
      type: "updateSetting",
      key: "agentDestination",
      value: "copilotChat",
    });
    expect(updateMock).toHaveBeenCalledWith(
      "agentDestination",
      "copilotChat",
      vscode.ConfigurationTarget.Global,
    );
  });
});
