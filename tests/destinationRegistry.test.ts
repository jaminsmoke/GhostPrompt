import { beforeEach, describe, expect, it, vi } from "vitest";

const configGetMock = vi.hoisted(() => vi.fn());
const getExtensionMock = vi.hoisted(() => vi.fn());

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: configGetMock,
      inspect: () => ({
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
    }),
  },
  extensions: {
    getExtension: getExtensionMock,
  },
}));

type TestModule = typeof import("../src/destinations/destinationRegistry");
let mod: TestModule;

beforeEach(async () => {
  vi.clearAllMocks();
  configGetMock.mockReturnValue("copilotChat");
  getExtensionMock.mockReturnValue(undefined);
  mod = await import("../src/destinations/destinationRegistry");
});

describe("destinationRegistry", () => {
  describe("registerDestination / getDestinationProviderForId", () => {
    it("registra y resuelve un provider por id", () => {
      const p1: ReturnType<typeof mod.registerDestination> = undefined!;
      mod.registerDestination({ id: "copilotChat", sendPrompt: vi.fn() });

      const found = mod.getDestinationProviderForId("copilotChat");
      expect(found).toBeDefined();
      expect(found!.id).toBe("copilotChat");
      expect(found!.sendPrompt).toBeDefined();
    });

    it("devuelve undefined si no hay provider registrado", () => {
      const found = mod.getDestinationProviderForId("vsOpenCodeX");
      expect(found).toBeUndefined();
    });
  });

  describe("getActiveDestinationProvider", () => {
    it("devuelve provider registrado si existe", () => {
      const sendPrompt = vi.fn();
      mod.registerDestination({ id: "copilotChat", sendPrompt });

      const active = mod.getActiveDestinationProvider();
      expect(active.id).toBe("copilotChat");
      expect(active.sendPrompt).toBe(sendPrompt);
    });

    it("devuelve fallback con sendPrompt vacío si no hay provider para el destino activo", () => {
      configGetMock.mockReturnValue("vsOpenCodeX");
      const active = mod.getActiveDestinationProvider();
      expect(active.id).toBe("vsOpenCodeX");
      expect(active.sendPrompt).toBeDefined();
    });

    it("lanza error al invocar sendPrompt de fallback no registrado", async () => {
      configGetMock.mockReturnValue("vsOpenCodeX");
      const active = mod.getActiveDestinationProvider();
      await expect(active.sendPrompt("hola")).rejects.toThrow(
        "Destination provider 'vsOpenCodeX' no está registrado",
      );
    });
  });

  describe("getGhostPromptAgentDestination", () => {
    it("retorna copilotChat por defecto sin VSX instalada", () => {
      configGetMock.mockReturnValue("copilotChat");
      getExtensionMock.mockReturnValue(undefined);
      expect(mod.getGhostPromptAgentDestination()).toBe("copilotChat");
    });

    it("retorna vsOpenCodeX si está configurado explícitamente", () => {
      configGetMock.mockReturnValue("vsOpenCodeX");
      expect(mod.getGhostPromptAgentDestination()).toBe("vsOpenCodeX");
    });
  });

  describe("isVsOpenCodeXExtensionInstalled", () => {
    it("retorna true si getExtension devuelve algo truthy", () => {
      getExtensionMock.mockReturnValue({ id: "jaminsmoke.vsopencodex" });
      expect(mod.isVsOpenCodeXExtensionInstalled()).toBe(true);
    });

    it("retorna false si getExtension devuelve undefined", () => {
      getExtensionMock.mockReturnValue(undefined);
      expect(mod.isVsOpenCodeXExtensionInstalled()).toBe(false);
    });
  });
});
