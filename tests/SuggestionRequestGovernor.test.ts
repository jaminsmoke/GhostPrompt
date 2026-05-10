import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
  },
}));

import { SuggestionRequestGovernor } from "../src/governor/SuggestionRequestGovernor";

const config = {
  minChars: 3,
  cooldownMs: 1000,
  cacheTtlMs: 60_000,
  rateLimitMaxRequests: 2,
  rateLimitWindowMs: 60_000,
  sessionBudget: 5,
};

describe("SuggestionRequestGovernor", () => {
  it("fromWorkspace usa los nuevos defaults de sprint 1", () => {
    const cfg = SuggestionRequestGovernor.fromWorkspace();
    expect(cfg.minChars).toBe(6);
    expect(cfg.cooldownMs).toBe(500);
    expect(cfg.cacheTtlMs).toBe(45_000);
    expect(cfg.rateLimitMaxRequests).toBe(90);
    expect(cfg.rateLimitWindowMs).toBe(600_000);
    expect(cfg.sessionBudget).toBe(300);
  });

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

  it("no colisiona cache entre idioma/estilo/contexto/modelo distintos", () => {
    const governor = new SuggestionRequestGovernor();
    const relaxedConfig = { ...config, rateLimitMaxRequests: 10 };
    const baseScope = {
      language: "es",
      style: "balanced",
      contextMode: "project",
      modelPolicy: "nonPremiumOnly",
      selectedModelId: "auto",
    };
    const first = governor.decide("hola mundo", relaxedConfig, baseScope);
    expect(first.kind).toBe("request");
    if (first.kind === "request") {
      governor.saveResult(
        first.key,
        { kind: "suggestion", suggestion: "continuacion" },
        relaxedConfig,
      );
    }

    const sameScope = governor.decide("hola mundo", relaxedConfig, baseScope);
    expect(sameScope.kind).toBe("serve-cache");

    const changedLanguage = governor.decide("hola mundo", relaxedConfig, {
      ...baseScope,
      language: "en",
    });
    expect(changedLanguage.kind).toBe("request");

    const changedStyle = governor.decide("hola mundo", relaxedConfig, {
      ...baseScope,
      style: "detailed",
    });
    expect(changedStyle.kind).toBe("request");
  });

  it("no reutiliza caché si cambia la huella del bootstrap del proyecto", () => {
    const governor = new SuggestionRequestGovernor();
    const relaxedConfig = { ...config, rateLimitMaxRequests: 10 };
    const scopeA = {
      language: "es",
      style: "balanced",
      contextMode: "project",
      modelPolicy: "nonPremiumOnly" as const,
      selectedModelId: "auto",
      projectBootstrapFingerprint: "aaaaaaaaaaaaaaaa",
    };
    const scopeB = { ...scopeA, projectBootstrapFingerprint: "bbbbbbbbbbbbbbbb" };
    const first = governor.decide("mismo texto", relaxedConfig, scopeA);
    expect(first.kind).toBe("request");
    if (first.kind === "request") {
      governor.saveResult(
        first.key,
        { kind: "suggestion", suggestion: "v1" },
        relaxedConfig,
      );
    }
    const miss = governor.decide("mismo texto", relaxedConfig, scopeB);
    expect(miss.kind).toBe("request");
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

  it("expone snapshot de uso para debug de presupuesto y ventana", () => {
    const governor = new SuggestionRequestGovernor();
    governor.decide("texto uno", config);
    governor.decide("texto dos", config);

    const usage = governor.getUsageSnapshot(config);
    expect(usage.requestsInWindow).toBe(2);
    expect(usage.remainingInWindow).toBe(0);
    expect(usage.sessionUsed).toBe(2);
    expect(usage.sessionRemaining).toBe(3);
    expect(usage.msUntilWindowReset).toBeGreaterThanOrEqual(0);
  });
});
