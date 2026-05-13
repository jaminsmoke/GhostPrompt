import { describe, expect, it } from "vitest";

import { removeIndexedEntriesForRelativePath } from "../src/core/memory/entries/mutation";
import { normalizeWorkspaceRelativePath, workspaceRelativePathsMatch } from "../src/core/memory/io/path";
import { PROJECT_BOOTSTRAP_ENTRY_KIND } from "../src/core/memory/types";
import { PROJECT_EDITOR_INGEST_ENTRY_KIND } from "../src/core/memory/types";

const z = "0".repeat(64);

describe("normalizeWorkspaceRelativePath", () => {
  it("normaliza separadores", () => {
    expect(normalizeWorkspaceRelativePath("a\\b/c")).toBe("a/b/c");
  });
});

describe("workspaceRelativePathsMatch", () => {
  it("considera equivalentes rutas con distinto separador", () => {
    expect(workspaceRelativePathsMatch("a/b", "a\\b")).toBe(true);
  });
});

describe("removeIndexedEntriesForRelativePath", () => {
  it("elimina bootstrap y editor con misma ruta", () => {
    const items = [
      {
        kind: PROJECT_BOOTSTRAP_ENTRY_KIND,
        relativePath: "README.md",
        promptLine: "x",
        sourceMtimeMs: 1,
        sourceSha256: z,
      },
      {
        kind: PROJECT_EDITOR_INGEST_ENTRY_KIND,
        relativePath: "src/x.ts",
        promptLine: "y",
        sourceMtimeMs: 2,
        sourceSha256: z,
        indexedAtMs: 1,
        lastUsedAtMs: 1,
      },
    ];
    const out = removeIndexedEntriesForRelativePath(items, "README.md");
    expect(out).toHaveLength(1);
    expect((out[0] as { relativePath: string }).relativePath).toBe("src/x.ts");
  });
});
