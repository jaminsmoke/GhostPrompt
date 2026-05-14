import * as path from 'node:path';

import {
  defaultManifest,
  defaultRegistry,
  parseEntriesJson,
  parseManifestJson,
  parseRegistryJson,
} from './io/json';
import type { ProjectMemoryManifestFile, ProjectMemoryRegistryFile } from './types';
import {
  ENTRIES_FILE,
  MANIFEST_FILE,
  PROJECT_MEMORY_SCHEMA_VERSION,
  REGISTRY_FILE,
  STORES_DIR,
} from './types';
import type { ProjectMemoryFsAdapter } from './io/fs';
import { workspaceKeyFromRootUriString } from './io/key';

export class ProjectMemoryStore {
  public constructor(
    private readonly baseDir: string,
    private readonly fs: ProjectMemoryFsAdapter,
  ) {}

  public registryFilePath(): string {
    return path.join(this.baseDir, REGISTRY_FILE);
  }

  public storeAbsoluteDir(workspaceKey: string): string {
    if (!ProjectMemoryStore.isValidWorkspaceKey(workspaceKey)) {
      throw new Error('invalid workspaceKey');
    }
    return path.join(this.baseDir, STORES_DIR, workspaceKey);
  }

  /** Garantiza `baseDir/` y `baseDir/stores/`. */
  public async ensureBaseLayout(): Promise<void> {
    await this.fs.mkdir(this.baseDir, { recursive: true });
    await this.fs.mkdir(path.join(this.baseDir, STORES_DIR), { recursive: true });
  }

  /**
   * Crea `stores/<key>/` sin tocar registry (persistencia rápida en caliente del suggest).
   * @param workspaceRootUriString URI canónico de la raíz del workspace.
   * @returns Clave del workspace derivada del URI.
   */
  public async ensureStoresDirExistsForWorkspaceRoot(
    workspaceRootUriString: string,
  ): Promise<string> {
    const workspaceKey = workspaceKeyFromRootUriString(workspaceRootUriString);
    await this.ensureBaseLayout();
    await this.fs.mkdir(this.storeAbsoluteDir(workspaceKey), { recursive: true });
    return workspaceKey;
  }

  public async loadRegistry(): Promise<ProjectMemoryRegistryFile> {
    const raw = await this.fs.readFileUtf8(this.registryFilePath());
    if (raw === undefined) {
      return defaultRegistry();
    }
    return parseRegistryJson(raw);
  }

  public async saveRegistry(registry: ProjectMemoryRegistryFile): Promise<void> {
    await this.ensureBaseLayout();
    const serialized = `${JSON.stringify(registry, null, 2)}\n`;
    await this.fs.writeFileUtf8(this.registryFilePath(), serialized);
  }

  public async readManifest(workspaceKey: string): Promise<ProjectMemoryManifestFile> {
    const dir = this.storeAbsoluteDir(workspaceKey);
    const raw = await this.fs.readFileUtf8(path.join(dir, MANIFEST_FILE));
    if (raw === undefined) {
      return defaultManifest(workspaceKey, Date.now());
    }
    return parseManifestJson(raw, workspaceKey);
  }

  public async writeManifest(manifest: ProjectMemoryManifestFile): Promise<void> {
    const dir = this.storeAbsoluteDir(manifest.workspaceKey);
    await this.fs.mkdir(dir, { recursive: true });
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    await this.fs.writeFileUtf8(path.join(dir, MANIFEST_FILE), serialized);
  }

  public async readEntriesJson(workspaceKey: string): Promise<unknown[]> {
    const dir = this.storeAbsoluteDir(workspaceKey);
    const raw = await this.fs.readFileUtf8(path.join(dir, ENTRIES_FILE));
    if (raw === undefined) {
      return [];
    }
    return parseEntriesJson(raw).items;
  }

  public async writeMemoryEntries(workspaceKey: string, items: unknown[]): Promise<void> {
    const dir = this.storeAbsoluteDir(workspaceKey);
    await this.fs.mkdir(dir, { recursive: true });
    const payload = JSON.stringify(
      { schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION, items },
      null,
      2,
    );
    await this.fs.writeFileUtf8(path.join(dir, ENTRIES_FILE), `${payload}\n`);
  }

  /**
   * Crea manifest + entries placeholder y actualiza `lastSeenAt` del registro.
   * @param workspaceRootUriString URI canónico del workspace.
   * @param nowMs Fecha/hora actual en milisegundos.
   * @returns Clave del workspace del directorio creado.
   */
  public async touchWorkspaceRoot(workspaceRootUriString: string, nowMs: number): Promise<string> {
    const workspaceKey = workspaceKeyFromRootUriString(workspaceRootUriString);
    await this.ensureBaseLayout();

    const storeDir = this.storeAbsoluteDir(workspaceKey);
    await this.fs.mkdir(storeDir, { recursive: true });

    const manifestPath = path.join(storeDir, MANIFEST_FILE);
    let manifest =
      (await this.fs.readFileUtf8(manifestPath)) !== undefined
        ? await this.readManifest(workspaceKey)
        : defaultManifest(workspaceKey, nowMs);
    manifest = {
      ...manifest,
      workspaceKey,
      updatedAtMs: nowMs,
    };
    await this.writeManifest(manifest);

    const entriesPath = path.join(storeDir, ENTRIES_FILE);
    if ((await this.fs.readFileUtf8(entriesPath)) === undefined) {
      await this.writeMemoryEntries(workspaceKey, []);
    }

    const registry = await this.loadRegistry();
    const storeRelativePath = `${STORES_DIR}/${workspaceKey}`;
    const next = { ...registry, entries: [...registry.entries] };
    const idx = next.entries.findIndex((e) => e.workspaceKey === workspaceKey);
    if (idx >= 0) {
      next.entries[idx] = {
        workspaceKey,
        storeRelativePath,
        lastSeenAt: nowMs,
      };
    } else {
      next.entries.push({ workspaceKey, storeRelativePath, lastSeenAt: nowMs });
    }
    await this.saveRegistry(next);
    return workspaceKey;
  }

  /**
   * Borra carpeta del store y quita la fila del registro (si existía).
   * @param workspaceRootUriString URI canónico del workspace a limpiar.
   * @returns `true` si existía entrada o directorio persistido.
   */
  public async clearWorkspaceRoot(workspaceRootUriString: string): Promise<boolean> {
    const workspaceKey = workspaceKeyFromRootUriString(workspaceRootUriString);
    const registry = await this.loadRegistry();
    const hadRegistry = registry.entries.some((e) => e.workspaceKey === workspaceKey);
    const manifestPath = path.join(this.storeAbsoluteDir(workspaceKey), MANIFEST_FILE);
    const hadManifest = (await this.fs.readFileUtf8(manifestPath)) !== undefined;

    await this.removeStoreDirectory(workspaceKey);

    const filtered = registry.entries.filter((e) => e.workspaceKey !== workspaceKey);
    if (filtered.length !== registry.entries.length) {
      await this.saveRegistry({ ...registry, entries: filtered });
    }

    return hadRegistry || hadManifest;
  }

  /**
   * Elimina árboles antiguos cuyo `lastSeenAt` supera el TTL. Devuelve nº eliminados.
   * Conviene llamar **después** de `touchOpenWorkspaceRoots` para no borrar el repo abierto.
   * @param ttlMs Tiempo de vida en milisegundos para considerar un store inactivo.
   * @param nowMs Marca de tiempo actual en milisegundos.
   * @returns Número de árboles eliminados.
   */
  public async garbageCollectUnusedStores(ttlMs: number, nowMs: number): Promise<number> {
    const registry = await this.loadRegistry();
    if (registry.entries.length === 0) {
      return 0;
    }
    let removed = 0;
    const kept = [];
    for (const entry of registry.entries) {
      if (nowMs - entry.lastSeenAt > ttlMs) {
        await this.removeStoreDirectory(entry.workspaceKey);
        removed += 1;
      } else {
        kept.push(entry);
      }
    }
    if (kept.length !== registry.entries.length) {
      await this.saveRegistry({ ...registry, entries: kept });
    }
    return removed;
  }

  private async removeStoreDirectory(workspaceKey: string): Promise<void> {
    if (!ProjectMemoryStore.isValidWorkspaceKey(workspaceKey)) {
      return;
    }
    const dir = path.join(this.baseDir, STORES_DIR, workspaceKey);
    await this.fs.rmDirRecursive(dir);
  }

  public static isValidWorkspaceKey(key: string): boolean {
    return /^[a-f0-9]{64}$/.test(key);
  }
}
