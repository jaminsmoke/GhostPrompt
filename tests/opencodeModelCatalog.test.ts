import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockStart, mockGetClient, mockGetOpenCodeRuntime } = vi.hoisted(() => {
  const mockStart = vi.fn();
  const mockGetClient = vi.fn();
  const mockGetOpenCodeRuntime = vi.fn(() => ({
    start: mockStart,
    getClient: mockGetClient,
  }));
  return { mockStart, mockGetClient, mockGetOpenCodeRuntime };
});

vi.mock("../src/opencode/OpenCodeRuntime", () => ({
  getOpenCodeRuntime: mockGetOpenCodeRuntime,
}));

const configGetMock = vi.fn();

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: configGetMock,
    }),
  },
}));

import { listOpencodeSuggestionModels } from "../src/completion/catalog/opencodeModelCatalog";
import { invalidateOpenCodeProvidersSnapshot } from "../src/opencode/opencodeProvidersSnapshot";

describe("listOpencodeSuggestionModels", () => {
  beforeEach(() => {
    invalidateOpenCodeProvidersSnapshot();
    mockStart.mockReset();
    mockGetClient.mockReset();
    mockGetOpenCodeRuntime.mockClear();
    configGetMock.mockReset();
    configGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "opencodeExcludedModelIds") {
        return [];
      }
      return defaultValue;
    });
  });

  it("returns empty array when runtime start fails", async () => {
    mockStart.mockResolvedValue({ ok: false, error: "no cli" });
    const models = await listOpencodeSuggestionModels("nonPremiumOnly");
    expect(models).toEqual([]);
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it("returns empty array when client is missing", async () => {
    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue(undefined);
    expect(await listOpencodeSuggestionModels("nonPremiumOnly")).toEqual([]);
  });

  it("maps models array from config.providers() into descriptors", async () => {
    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
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
        }),
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
    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
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
        }),
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
    configGetMock.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "opencodeExcludedModelIds") {
        return ["anthropic/claude-3"];
      }
      return defaultValue;
    });

    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => ({
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
        }),
      },
    });

    expect(await listOpencodeSuggestionModels("nonPremiumOnly")).toEqual([]);
  });

  it("returns empty on providers() throw", async () => {
    mockStart.mockResolvedValue({ ok: true });
    mockGetClient.mockReturnValue({
      config: {
        providers: async () => {
          throw new Error("network");
        },
      },
    });

    expect(await listOpencodeSuggestionModels("nonPremiumOnly")).toEqual([]);
  });
});
