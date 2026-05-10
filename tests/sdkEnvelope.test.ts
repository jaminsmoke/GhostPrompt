import { describe, expect, it } from "vitest";

import {
  concatOpencodeAssistantTextParts,
  parseOpencodePromptResultPayload,
  readOpencodeEnvelopeFailure,
  unwrapOpencodeEnvelopeData,
  unpackOpencodeSessionCreateId,
} from "../src/opencode/sdkEnvelope";

describe("sdkEnvelope", () => {
  it("unwrapOpencodeEnvelopeData extrae data tipada", () => {
    expect(
      unwrapOpencodeEnvelopeData<{ x: number }>({ data: { x: 1 } }),
    ).toEqual({ x: 1 });
    expect(unwrapOpencodeEnvelopeData<{ x: number }>({})).toBeUndefined();
    expect(unwrapOpencodeEnvelopeData<{ x: number }>(null)).toBeUndefined();
  });

  it("readOpencodeEnvelopeFailure lee string u objeto con message", () => {
    expect(readOpencodeEnvelopeFailure({ error: "boom" })).toBe("boom");
    expect(
      readOpencodeEnvelopeFailure({ error: { message: "nested" } }),
    ).toBe("nested");
    expect(readOpencodeEnvelopeFailure({ data: {} })).toBeUndefined();
  });

  it("unpackOpencodeSessionCreateId", () => {
    expect(unpackOpencodeSessionCreateId({ data: { id: "sid1" } })).toBe(
      "sid1",
    );
    expect(unpackOpencodeSessionCreateId({ data: { id: "   " } })).toBeUndefined();
    expect(unpackOpencodeSessionCreateId({ data: {} })).toBeUndefined();
    expect(unpackOpencodeSessionCreateId({})).toBeUndefined();
  });

  it("parseOpencodePromptResultPayload y concat de partes texto", () => {
    const payload = parseOpencodePromptResultPayload({
      data: {
        parts: [
          { type: "text", text: "a" },
          { type: "skip", foo: 1 },
          { type: "text", text: "b" },
        ],
      },
    });
    expect(concatOpencodeAssistantTextParts(payload?.parts)).toBe("ab");
  });
});
