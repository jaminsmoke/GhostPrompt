import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  ensureNodeFetchDuplex,
  wrapFetchWithNodeDuplex,
} from "../src/opencode/nodeFetchDuplex";

describe("wrapFetchWithNodeDuplex", () => {
  beforeAll(() => {
    ensureNodeFetchDuplex();
  });

  it("añade duplex half cuando init.body es ReadableStream", async () => {
    const seenInits: RequestInit[] = [];
    const mockFetch = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (init) {
          seenInits.push(init);
        }
        return new Response("ok");
      },
    );

    const wrapped = wrapFetchWithNodeDuplex(mockFetch as typeof fetch);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([48]));
        c.close();
      },
    });

    await wrapped("http://example.test/x", {
      method: "POST",
      body: stream,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(seenInits[0]?.duplex).toBe("half");
  });

  it("añade duplex cuando se usa fetch(Request) con body stream y sin init", async () => {
    const seen: Array<{ duplex?: string }> = [];
    const mockFetch = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        seen.push(init ?? {});
        return new Response("ok");
      },
    );

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([49]));
        c.close();
      },
    });

    const req = new Request("http://example.test/y", {
      method: "POST",
      body: stream,
    });

    const wrapped = wrapFetchWithNodeDuplex(mockFetch as typeof fetch);
    await wrapped(req);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(seen[0]?.duplex).toBe("half");
  });
});
