import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: vi.fn(() => false),
    }),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
    })),
  },
}));

import {
  getOpenCodeProvidersSnapshot,
  invalidateOpenCodeProvidersSnapshot,
} from "../src/opencode/opencodeProvidersSnapshot";

beforeEach(() => {
  invalidateOpenCodeProvidersSnapshot();
});

function makeClient(providersImpl: () => Promise<unknown>) {
  return {
    config: { providers: vi.fn(providersImpl) },
  };
}

describe("getOpenCodeProvidersSnapshot", () => {
  it("dedupes concurrent callers into one providers() invocation", async () => {
    let calls = 0;
    const client = makeClient(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 15));
      return {
        data: {
          providers: [{ id: "p", models: [] }],
          default: {},
        },
      };
    });

    const [a, b] = await Promise.all([
      getOpenCodeProvidersSnapshot(client),
      getOpenCodeProvidersSnapshot(client),
    ]);

    expect(calls).toBe(1);
    expect(a?.providers?.[0]?.id).toBe("p");
    expect(b).toBe(a);
  });

  it("returns cached snapshot without calling providers again", async () => {
    const spy = vi.fn(async () => ({
      data: { providers: [{ id: "once", models: [] }], default: {} },
    }));
    const client = makeClient(spy);

    await getOpenCodeProvidersSnapshot(client);
    await getOpenCodeProvidersSnapshot(client);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("refetches after invalidate", async () => {
    const spy = vi.fn(async () => ({
      data: { providers: [{ id: "a", models: [] }], default: {} },
    }));
    const client = makeClient(spy);

    await getOpenCodeProvidersSnapshot(client);
    invalidateOpenCodeProvidersSnapshot();
    await getOpenCodeProvidersSnapshot(client);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns undefined when providers rejects and retries on next get (no poisoned cache)", async () => {
    const spy = vi.fn().mockRejectedValue(new Error("network"));
    const client = { config: { providers: spy } };

    await expect(getOpenCodeProvidersSnapshot(client)).resolves.toBeUndefined();
    await expect(getOpenCodeProvidersSnapshot(client)).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
