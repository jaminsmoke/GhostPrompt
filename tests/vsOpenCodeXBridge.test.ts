import { beforeEach, describe, expect, it, vi } from "vitest";

const executeCommandMock = vi.hoisted(() => vi.fn());
const activateMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getExtensionMock = vi.hoisted(() => vi.fn());

vi.mock("../src/debug/SuggestionDebug", () => ({
  logOpenCodeDebug: vi.fn(),
}));

vi.mock("../src/opencode/nodeFetchDuplex", () => ({
  ensureNodeFetchDuplex: vi.fn(),
}));

const createOpencodeClientMock = vi.hoisted(() =>
  vi.fn(() => ({ mockClient: true })),
);

vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: createOpencodeClientMock,
}));

vi.mock("vscode", () => ({
  extensions: {
    getExtension: (...args: unknown[]) => getExtensionMock(...args),
  },
  commands: {
    executeCommand: (...args: unknown[]) => executeCommandMock(...args),
  },
}));

import {
  COMMAND_GET_OPENCODE_CONNECTION,
  tryCreateSdkClientViaVsOpenCodeX,
  VS_OPEN_CODE_X_EXTENSION_ID,
} from "../src/opencode/vsOpenCodeXBridge";

describe("vsOpenCodeXBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExtensionMock.mockReturnValue(undefined);
  });

  it("sin VSOpenCodeX instalada devuelve undefined", async () => {
    const r = await tryCreateSdkClientViaVsOpenCodeX({ probeDelayMs: 0 });
    expect(r).toBeUndefined();
    expect(executeCommandMock).not.toHaveBeenCalled();
  });

  it("con conexión ok crea cliente SDK con baseUrl y Authorization", async () => {
    getExtensionMock.mockReturnValue({
      isActive: true,
      activate: activateMock,
    });
    executeCommandMock.mockResolvedValue({
      ok: true,
      baseUrl: "http://127.0.0.1:17433",
      authorizationHeader: "Basic xxx",
      port: 17433,
    });

    const r = await tryCreateSdkClientViaVsOpenCodeX({ probeDelayMs: 0 });

    expect(activateMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith(
      COMMAND_GET_OPENCODE_CONNECTION,
    );
    expect(createOpencodeClientMock).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:17433",
      headers: { Authorization: "Basic xxx" },
    });
    expect(r).toEqual({
      client: { mockClient: true },
      baseUrl: "http://127.0.0.1:17433",
    });
    expect(getExtensionMock).toHaveBeenCalledWith(VS_OPEN_CODE_X_EXTENSION_ID);
  });

  it("activate si la extensión existe pero no está activa", async () => {
    getExtensionMock.mockReturnValue({
      isActive: false,
      activate: activateMock,
    });
    executeCommandMock.mockResolvedValue({
      ok: false,
      reason: "server not ready",
    });
    await tryCreateSdkClientViaVsOpenCodeX({ probeDelayMs: 0 });
    expect(activateMock).toHaveBeenCalled();
  });

  it("ok:false no crea cliente", async () => {
    getExtensionMock.mockReturnValue({ isActive: true, activate: activateMock });
    executeCommandMock.mockResolvedValue({
      ok: false,
      reason: "offline",
    });
    expect(await tryCreateSdkClientViaVsOpenCodeX({ probeDelayMs: 0 })).toBeUndefined();
    expect(createOpencodeClientMock).not.toHaveBeenCalled();
  });
});
