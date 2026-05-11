import { beforeEach, describe, expect, it, vi } from "vitest";

const configGetMock = vi.hoisted(() => vi.fn());
const getExtensionMock = vi.hoisted(() => vi.fn());
const tryCreateMock = vi.hoisted(() => vi.fn());
const createOpencodeMock = vi.hoisted(() => vi.fn());
const checkOpenCodeCliMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ ok: true as const, version: "0.0.0" })),
);

vi.mock("../src/debug/SuggestionDebug", () => ({
  logOpenCodeDebug: vi.fn(),
}));

vi.mock("../src/opencode/nodeFetchDuplex", () => ({
  ensureNodeFetchDuplex: vi.fn(),
}));

vi.mock("../src/opencode/openCodeCli", () => ({
  checkOpenCodeCli: (...args: unknown[]) => checkOpenCodeCliMock(...args),
}));

vi.mock("../src/opencode/vsOpenCodeXBridge", () => ({
  tryCreateSdkClientViaVsOpenCodeX: (...args: unknown[]) => tryCreateMock(...args),
  VS_OPEN_CODE_X_EXTENSION_ID: "jaminsmoke.vsopencodex",
}));

vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: (...args: unknown[]) => createOpencodeMock(...args),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => configGetMock(key, fallback),
    }),
  },
  extensions: {
    getExtension: (...args: unknown[]) => getExtensionMock(...args),
  },
}));

describe("OpenCodeRuntime — sin embebido si VSX instalado", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    configGetMock.mockImplementation((key: string, fallback: unknown) => {
      if (key === "preferVsOpenCodeXOpenCode") return true;
      if (key === "vsOpenCodeXProbeDelayMs") return 0;
      if (key === "vsOpenCodeXConnectionMaxAttempts") return 2;
      if (key === "vsOpenCodeXConnectionRetryGapMs") return 0;
      return fallback;
    });
    getExtensionMock.mockReturnValue({ isActive: true });
    tryCreateMock.mockResolvedValue(undefined);
    createOpencodeMock.mockResolvedValue({
      client: {},
      server: { url: "http://127.0.0.1:17433", close: vi.fn() },
    });
  });

  it("no llama createOpencode ni checkOpenCodeCli si VSX está instalado y el bridge falla", async () => {
    const { getOpenCodeRuntime } = await import("../src/opencode/OpenCodeRuntime");
    const runtime = getOpenCodeRuntime();
    runtime.stop();
    const r = await runtime.start();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("VSOpenCodeX");
    }
    expect(tryCreateMock).toHaveBeenCalled();
    expect(createOpencodeMock).not.toHaveBeenCalled();
    expect(checkOpenCodeCliMock).not.toHaveBeenCalled();
  });

  it("sí puede usar embebido si VSX no está instalado", async () => {
    getExtensionMock.mockReturnValue(undefined);
    const { getOpenCodeRuntime } = await import("../src/opencode/OpenCodeRuntime");
    const runtime = getOpenCodeRuntime();
    runtime.stop();
    const r = await runtime.start();
    expect(r.ok).toBe(true);
    expect(tryCreateMock).toHaveBeenCalled();
    expect(checkOpenCodeCliMock).toHaveBeenCalled();
    expect(createOpencodeMock).toHaveBeenCalled();
  });
});
