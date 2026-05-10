import { describe, expect, it } from "vitest";

import { applyEditorIngestLruEviction } from "../src/projectMemory/editorIngestLru";
import { PROJECT_EDITOR_INGEST_ENTRY_KIND } from "../src/projectMemory/projectMemoryTypes";
import type { ProjectMemoryEditorIngestStoredItem } from "../src/projectMemory/projectMemoryTypes";

function ed(
  path: string,
  last: number,
  prompt = "x",
): ProjectMemoryEditorIngestStoredItem {
  const z = "0".repeat(64);
  return {
    kind: PROJECT_EDITOR_INGEST_ENTRY_KIND,
    relativePath: path,
    promptLine: prompt,
    sourceMtimeMs: 1,
    sourceSha256: z,
    indexedAtMs: 1,
    lastUsedAtMs: last,
  };
}

describe("applyEditorIngestLruEviction", () => {
  it("recorta por número de entradas (mayor lastUsedAt conservado)", () => {
    const items = [ed("a.ts", 10), ed("b.ts", 20), ed("c.ts", 30)];
    const out = applyEditorIngestLruEviction(items, 2, 10_000_000);
    expect(out.map((e) => e.relativePath).sort()).toEqual(["b.ts", "c.ts"]);
  });

  it("conserva una única entrada cuando cabe en recuento y techo de bytes", () => {
    const items = [ed("a.ts", 10)];
    expect(
      applyEditorIngestLruEviction(items, 5, 500_000).map((e) => e.relativePath),
    ).toEqual(["a.ts"]);
  });

  it("evita por bytes totales aproximados cuando hay payload grande", () => {
    const big = "z".repeat(50_000);
    const items = [
      ed("old.ts", 1, big),
      ed("new.ts", 100, big),
      ed("mid.ts", 50, big),
    ];
    const out = applyEditorIngestLruEviction(items, 10, 120_000);
    expect(out.length).toBeLessThan(items.length);
    expect(out.every((e) => e.relativePath !== "old.ts")).toBe(true);
  });
});
