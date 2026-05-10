import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogPerf } = vi.hoisted(() => ({
  mockLogPerf: vi.fn(),
}));

vi.mock("../src/debug/SuggestionDebug", () => ({
  logOpenCodePerfCapture: mockLogPerf,
  isSuggestionDebugEnabled: vi.fn(() => true),
  logOpenCodeDebug: vi.fn(),
  logSuggestionDebug: vi.fn(),
}));

import {
  getOpenCodeProvidersSnapshot,
  invalidateOpenCodeProvidersSnapshot,
} from "../src/opencode/opencodeProvidersSnapshot";

beforeEach(() => {
  invalidateOpenCodeProvidersSnapshot();
  mockLogPerf.mockClear();
});

describe("getOpenCodeProvidersSnapshot (perf capture)", () => {
  it("no llama logOpenCodePerfCapture sin perfCaptureId (p. ej. warm / catálogo)", async () => {
    const spy = vi.fn(async () => ({
      data: { providers: [{ id: "p", models: [] }], default: {} },
    }));
    const client = { config: { providers: spy } };

    await getOpenCodeProvidersSnapshot(client);

    expect(mockLogPerf).not.toHaveBeenCalled();
  });

  it("registra cache-hit cuando perfCaptureId está definido", async () => {
    const spy = vi.fn(async () => ({
      data: { providers: [{ id: "p", models: [] }], default: {} },
    }));
    const client = { config: { providers: spy } };

    await getOpenCodeProvidersSnapshot(client, { perfCaptureId: 3 });
    mockLogPerf.mockClear();

    await getOpenCodeProvidersSnapshot(client, { perfCaptureId: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      mockLogPerf.mock.calls.some(
        (c) => c[1] === "providers" && String(c[2]).includes("cache-hit"),
      ),
    ).toBe(true);
  });
});
