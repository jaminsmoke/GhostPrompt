export const PROJECT_MEMORY_SCHEMA_VERSION = 1 as const;

export const REGISTRY_FILE = 'registry.json';
export const STORES_DIR = 'stores';
export const MANIFEST_FILE = 'manifest.json';
export const ENTRIES_FILE = 'entries.json';

/** Subcarpeta versionada bajo `globalStorageUri`. */
export const PROJECT_MEMORY_REL_SEGMENTS = ['ghostPrompt', 'projectMemory', 'v1'] as const;

export interface ProjectMemoryRegistryEntry {
  workspaceKey: string;
  /** Relativo a la raíz del almacén v1; hoy siempre `stores/<workspaceKey>`. */
  storeRelativePath: string;
  lastSeenAt: number;
}

export interface ProjectMemoryRegistryFile {
  schemaVersion: typeof PROJECT_MEMORY_SCHEMA_VERSION;
  entries: ProjectMemoryRegistryEntry[];
}

export interface ProjectMemoryManifestFile {
  schemaVersion: typeof PROJECT_MEMORY_SCHEMA_VERSION;
  workspaceKey: string;
  updatedAtMs: number;
  quotas: {
    maxTotalBytes: number;
    maxEntryBytes: number;
  };
  stats: {
    entryCount: number;
  };
}

export const PROJECT_BOOTSTRAP_ENTRY_KIND = 'bootstrap' as const;

/** Entrada tipo bootstrap persistida en `entries.json` (fase C+). */
export interface ProjectMemoryBootstrapStoredItem {
  kind: typeof PROJECT_BOOTSTRAP_ENTRY_KIND;
  /** Ruta relativa al workspace (p. Ej. `README.md`, `package.json`). */
  relativePath: string;
  /** Línea enviada al LM (card fase A). */
  promptLine: string;
  /** `FileStat.mtime` del archivo fuente al indexar (ms desde epoch). */
  sourceMtimeMs: number;
  /** SHA-256 hexadecimal del contenido crudo UTF-8 leído. */
  sourceSha256: string;
}

export const PROJECT_EDITOR_INGEST_ENTRY_KIND = 'editor-ingest' as const;

/** Extracto indexado al enfocar documentos del workspace (fase D). */
export interface ProjectMemoryEditorIngestStoredItem {
  kind: typeof PROJECT_EDITOR_INGEST_ENTRY_KIND;
  relativePath: string;
  promptLine: string;
  sourceMtimeMs: number;
  sourceSha256: string;
  indexedAtMs: number;
  /** LRU: último uso en prompt sugerencia o re-focus sin cambios. */
  lastUsedAtMs: number;
}

export interface ProjectMemoryEntriesFile {
  schemaVersion: typeof PROJECT_MEMORY_SCHEMA_VERSION;
  /** Entradas: bootstrap y futuros kinds (ingección editor); validar antes de usar. */
  items: unknown[];
}
