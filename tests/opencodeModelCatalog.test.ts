import { beforeEach, describe, expect, it, vi } from "vitest";

const { configProvidersMock, fakeSdkClient } = vi.hoisted(() => {
  const configProvidersMock = vi.fn();
  const fakeSdkClient = {
    config: { providers: configProvidersMock },
  };
  return { configProvidersMock, fakeSdkClient };
});

vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn(() => fakeSdkClient),
}));

const cfgGetMock = vi.fn();
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: cfgGetMock,
    }),
  },
}));

import { listOpencodeSuggestionModels } from "../src/engines/opencode/catalog/opencodeModelCatalog";

beforeEach(() => {
  vi.resetAllMocks();
  cfgGetMock.mockImplementation((key: string, defaultValue: unknown) => {
    if (key === "opencodeExcludedModelIds") return [];
    if (key === "opencodePort") return 4096;
    if (key === "opencodeAuthToken") return undefined;
    return defaultValue;
  });
});

describe("listOpencodeSuggestionModels", () => {
  it("returns empty array when createOpenCodeClient throws", async () => {
    const sdk = await import("@opencode-ai/sdk");
    vi.mocked(sdk.createOpencodeClient).mockImplementation(() => {
      throw new Error("CLI missing");
    });
    const models = await listOpencodeSuggestionModels("nonPremiumOnly");
    expect(models).toEqual([]);
  });

  it("maps models array from config.providers() into descriptors", async () => {
    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: "openai",
            name: "OpenAI",
            models: [
              { id: "gpt-4o-mini", name: "GPT-4o mini", pricing: "0x" },
              { id: "gpt-4", name: "GPT-4", pricing: "1x" },
            ],
          },
        ],
        default: {},
      },
    });

    const models = await listOpencodeSuggestionModels("anyModel");
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.id).sort()).toEqual([
      "openai/gpt-4",
      "openai/gpt-4o-mini",
    ]);
    expect(models.find((m) => m.id === "openai/gpt-4o-mini")?.tier).toBe(
      "included",
    );
    expect(models.find((m) => m.id === "openai/gpt-4")?.tier).toBe("premium");
  });

  it("maps config.providers() map-shaped models into descriptors", async () => {
    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              m1: { id: "claude-3", name: "Claude 3" },
            },
          },
        ],
        default: {},
      },
    });

    const models = await listOpencodeSuggestionModels("nonPremiumOnly");
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "anthropic/claude-3",
      label: "Claude 3",
      tier: "unknown",
      provider: "Anthropic",
    });
  });

  it("respects ghostPrompt.opencodeExcludedModelIds", async () => {
    cfgGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "opencodeExcludedModelIds") return ["anthropic/claude-3"];
      if (key === "opencodePort") return 4096;
      if (key === "opencodeAuthToken") return undefined;
      return defaultValue;
    });

    configProvidersMock.mockResolvedValue({
      data: {
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              m1: { id: "claude-3", name: "Claude 3" },
            },
          },
        ],
        default: {},
      },
    });

    expect(await listOpencodeSuggestionModels("nonPremiumOnly")).toEqual([]);
  });

  it("returns empty on providers() throw", async () => {
    configProvidersMock.mockRejectedValue(new Error("network"));
    expect(await listOpencodeSuggestionModels("nonPremiumOnly")).toEqual([]);
  });
});