import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
  },
}));

import { SuggestionRequestGovernor } from "../src/SuggestionRequestGovernor";

const config = {
  minChars: 3,
  cooldownMs: 1000,
  cacheTtlMs: 60_000,
  rateLimitMaxRequests: 2,
  rateLimitWindowMs: 60_000,
  sessionBudget: 5,
};

describe("SuggestionRequestGovernor", () => {
  it("bloquea texto demasiado corto", () => {
    const governor = new SuggestionRequestGovernor();
    const result = governor.decide("ab", config);
    expect(result).toEqual({ kind: "block", reason: "too-short" });
  });

  it("sirve desde cache para mismo input normalizado", () => {
    const governor = new SuggestionRequestGovernor();
    const first = governor.decide("Hola mundo", config);
    expect(first.kind).toBe("request");
    if (first.kind === "request") {
      governor.saveResult(
        first.key,
        { kind: "suggestion", suggestion: "continuacion" },
        config,
      );
    }

    const second = governor.decide("  hola   mundo ", config);
    expect(second.kind).toBe("serve-cache");
  });

  it("aplica rate limit tras superar ventana", () => {
    const governor = new SuggestionRequestGovernor();
    const one = governor.decide("texto uno", config);
    const two = governor.decide("texto dos", config);
    const three = governor.decide("texto tres", config);
    expect(one.kind).toBe("request");
    expect(two.kind).toBe("request");
    expect(three).toEqual({ kind: "block", reason: "rate-limited" });
  });
});
