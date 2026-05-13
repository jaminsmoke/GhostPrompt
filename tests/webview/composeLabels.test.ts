import { describe, expect, it } from "vitest";
import {
  composeContextShort,
  composeLangShort,
  composeStyleShort,
} from "../../src/ui/webview/lib/composeLabels";

describe("webview composeLabels", () => {
  it("composeStyleShort", () => {
    expect(composeStyleShort("concise")).toBe("Breve");
    expect(composeStyleShort("balanced")).toBe("Normal");
    expect(composeStyleShort("detailed")).toBe("Extenso");
  });

  it("composeContextShort", () => {
    expect(composeContextShort("project")).toBe("Proyecto");
    expect(composeContextShort("off")).toBe("Off");
    expect(composeContextShort("basic")).toBe("Básico");
  });

  it("composeLangShort", () => {
    expect(composeLangShort("auto", "es")).toContain("Auto");
    expect(composeLangShort("en", "en")).toBe("EN");
    expect(composeLangShort("es", "es")).toBe("ES");
  });
});
