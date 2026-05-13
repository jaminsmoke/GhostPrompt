import { beforeEach, describe, expect, it, vi } from "vitest";

const executeCommandMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("vscode", () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("copilotChatDestination", () => {
  it("exporta sendToChat que llama a workbench.action.chat.open", async () => {
    const { sendToChat } = await import("../src/destinations/copilotChat/copilotChatDestination");
    await sendToChat("test prompt");
    expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.chat.open", {
      query: "test prompt",
    });
  });

  it("se registra automaticamente en destinationRegistry como copilotChat", async () => {
    // Importar el módulo real (efecto secundario: se registra el provider)
    await import("../src/destinations/copilotChat/copilotChatDestination");
    const { getDestinationProviderForId } = await import(
      "../src/destinations/destinationRegistry"
    );
    const provider = getDestinationProviderForId("copilotChat");
    expect(provider).toBeDefined();
    expect(provider!.id).toBe("copilotChat");
    expect(typeof provider!.sendPrompt).toBe("function");
  });
});
