import { describe, expect, it } from "vitest";
import {
  foldSuggestionStreamEvent,
  unwrapNormalizedSseEvent,
  type SuggestionStreamFoldState,
} from "../src/opencode/opencodeSuggestionStreamFold";

describe("unwrapNormalizedSseEvent", () => {
  it("acepta evento plano /event", () => {
    const u = unwrapNormalizedSseEvent({
      type: "message.part.delta",
      properties: { sessionID: "ses_1", partID: "p1", field: "text", delta: "hi" },
    });
    expect(u?.eventType).toBe("message.part.delta");
    expect(u?.properties.delta).toBe("hi");
  });

  it("acepta payload envuelto global/event", () => {
    const u = unwrapNormalizedSseEvent({
      directory: "/x",
      payload: {
        type: "message.part.updated",
        properties: {
          sessionID: "ses_1",
          part: { id: "prt1", type: "text" },
        },
      },
    });
    expect(u?.eventType).toBe("message.part.updated");
    expect((u?.properties.part as { type: string }).type).toBe("text");
  });
});

describe("foldSuggestionStreamEvent", () => {
  const empty: SuggestionStreamFoldState = { partKinds: new Map(), buffer: "" };

  it("ignora reasoning", () => {
    let s = foldSuggestionStreamEvent(empty, {
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: { id: "r1", type: "reasoning" },
      },
    });
    s = foldSuggestionStreamEvent(s, {
      type: "message.part.delta",
      properties: {
        sessionID: "ses_1",
        partID: "r1",
        field: "text",
        delta: "secret",
      },
    });
    expect(s.buffer).toBe("");
  });

  it("acumula solo type text", () => {
    let s = foldSuggestionStreamEvent(empty, {
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: { id: "t1", type: "text" },
      },
    });
    s = foldSuggestionStreamEvent(s, {
      type: "message.part.delta",
      properties: {
        sessionID: "ses_1",
        partID: "t1",
        field: "text",
        delta: " hola",
      },
    });
    expect(s.buffer).toBe(" hola");
  });
});
