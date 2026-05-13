import { beforeEach, describe, expect, it, vi } from "vitest";

const configGetMock = vi.hoisted(() => vi.fn());
const getExtensionMock = vi.hoisted(() => vi.fn());
const showInformationMessageMock = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => configGetMock(key, fallback),
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  extensions: {
    getExtension: (...args: unknown[]) => getExtensionMock(...args),
  },
  window: {
    showInformationMessage: (...args: unknown[]) =>
      showInformationMessageMock(...args) as Promise<undefined>,
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

describe("notifyVsxAgentDestinationIfExtensionMissing", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "copilotChat" : fallback,
    );
    getExtensionMock.mockReturnValue(undefined);
  });

  it("no notifica si destino es Copilot Chat", async () => {
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } = await import(
"../src/destinations/vsOpenCodeX/vsOpenCodeXDestination"
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });

  it("notifica una vez por sesión si destino VSX y extensión ausente", async () => {
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "vsOpenCodeX" : fallback,
    );
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } = await import(
"../src/destinations/vsOpenCodeX/vsOpenCodeXDestination"
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
  });

  it("reinicia el aviso al volver a copilotChat y otra vez a VSX", async () => {
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } = await import(
"../src/destinations/vsOpenCodeX/vsOpenCodeXDestination"
    );
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "vsOpenCodeX" : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "copilotChat" : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "vsOpenCodeX" : fallback,
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(2);
  });

  it("no notifica si la extensión VSX está presente", async () => {
    configGetMock.mockImplementation((key: string, fallback: unknown) =>
      key === "agentDestination" ? "vsOpenCodeX" : fallback,
    );
    getExtensionMock.mockReturnValue({ id: "jaminsmoke.vsopencodex" });
    const { notifyIfVsxAgentDestinationWithoutVsOpenCodeX } = await import(
"../src/destinations/vsOpenCodeX/vsOpenCodeXDestination"
    );
    notifyIfVsxAgentDestinationWithoutVsOpenCodeX();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });
});
