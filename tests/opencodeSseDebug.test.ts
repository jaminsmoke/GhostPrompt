import { describe, expect, it } from "vitest";
import { summarizeSsePayloadForDebug } from "../src/opencode/opencodeSsePayloadSummary";

describe("summarizeSsePayloadForDebug", () => {
  it("serializa objetos y trunca cadenas largas", () => {
    expect(summarizeSsePayloadForDebug({ a: 1 })).toBe('{"a":1}');
    const long = "x".repeat(2000);
    const s = summarizeSsePayloadForDebug(long);
    expect(s.length).toBeLessThanOrEqual(1202);
    expect(s.endsWith("…")).toBe(true);
  });
});
