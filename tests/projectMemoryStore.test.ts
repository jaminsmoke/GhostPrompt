import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { NodeProjectMemoryFs } from "../src/core/memory/io/fs";
import { ProjectMemoryStore } from "../src/core/memory/Store";
import {
  PROJECT_MEMORY_SCHEMA_VERSION,
  PROJECT_MEMORY_REL_SEGMENTS,
  REGISTRY_FILE,
  STORES_DIR,
  ENTRIES_FILE,
  MANIFEST_FILE,
  type ProjectMemoryRegistryFile,
  type ProjectMemoryManifestFile,
} from "../src/core/memory/types";
import { workspaceKeyFromRootUriString } from "../src/core/memory/io/key";

describe("workspaceKeyFromRootUriString", () => {
  it("es determinista por URI canónica", () => {
    expect(workspaceKeyFromRootUriString("file:///c%3A/demo")).toHaveLength(64);
    expect(workspaceKeyFromRootUriString("file:///c%3A/demo")).toBe(
      workspaceKeyFromRootUriString("file:///c%3A/demo"),
    );
    expect(workspaceKeyFromRootUriString("file:///c%3A/other")).not.toBe(
      workspaceKeyFromRootUriString("file:///c%3A/demo"),
    );
  });
});

describe("ProjectMemoryStore", () => {
  let baseDir: string;

  afterEach(async () => {
    if (baseDir) {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });

  it("touch crea manifest, entries placeholder y entrada de registro", async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "gp-pm-"));
    const store = new ProjectMemoryStore(baseDir, new NodeProjectMemoryFs());
    const now = Date.now();
    const root = "file:///tmp/repoAlpha";
    const key = workspaceKeyFromRootUriString(root);
    await store.touchWorkspaceRoot(root, now);

    const reg = await store.loadRegistry();
    expect(reg.entries).toHaveLength(1);
    expect(reg.entries[0].workspaceKey).toBe(key);
    expect(reg.entries[0].lastSeenAt).toBe(now);

    const manifest = await store.readManifest(key);
    expect(manifest.workspaceKey).toBe(key);
    expect(manifest.updatedAtMs).toBe(now);
    expect(manifest.quotas.maxTotalBytes).toBeGreaterThan(0);

    const items = await store.readEntriesJson(key);
    expect(items).toEqual([]);
  });

  it("gc elimina entradas muy antiguas y conserva la reciente tras touch", async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "gp-pm-"));
    const store = new ProjectMemoryStore(baseDir, new NodeProjectMemoryFs());
    const now = Date.now();
    await store.touchWorkspaceRoot("file:///tmp/repoFresh", now);
    const staleKey = workspaceKeyFromRootUriString("file:///tmp/repoStaleSynth");
    let reg = await store.loadRegistry();
    reg.entries.push({
      workspaceKey: staleKey,
      storeRelativePath: `${STORES_DIR}/${staleKey}`,
      lastSeenAt: now - 50 * 86_400_000,
    });
    await store.saveRegistry(reg);

    const staleDir = path.join(baseDir, STORES_DIR, staleKey);
    await fs.mkdir(staleDir, { recursive: true });
    await fs.writeFile(path.join(staleDir, "manifest.json"), "{}", "utf8");

    const removed = await store.garbageCollectUnusedStores(40 * 86_400_000, now);
    expect(removed).toBe(1);

    reg = await store.loadRegistry();
    expect(reg.entries).toHaveLength(1);
    expect(reg.entries[0].workspaceKey).not.toBe(staleKey);
  });

  it("clearWorkspaceRoot borra el directorio y la fila del registro", async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "gp-pm-"));
    const store = new ProjectMemoryStore(baseDir, new NodeProjectMemoryFs());
    const root = "file:///tmp/repoToClear";
    const key = workspaceKeyFromRootUriString(root);
    await store.touchWorkspaceRoot(root, Date.now());

    const had = await store.clearWorkspaceRoot(root);
    expect(had).toBe(true);

    const reg = await store.loadRegistry();
    expect(reg.entries.some((e) => e.workspaceKey === key)).toBe(false);

    const manifestPath = path.join(store.storeAbsoluteDir(key), MANIFEST_FILE);
    await expect(fs.stat(manifestPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reject invalid workspace keys en storeAbsoluteDir", () => {
    const store = new ProjectMemoryStore("/x", new NodeProjectMemoryFs());
    expect(() => store.storeAbsoluteDir("../evil")).toThrow("invalid workspaceKey");
  });
});
