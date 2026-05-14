import {
  PROJECT_MEMORY_SCHEMA_VERSION,
  type ProjectMemoryEntriesFile,
  type ProjectMemoryManifestFile,
  type ProjectMemoryRegistryEntry,
  type ProjectMemoryRegistryFile,
} from '../types';

/**
 * Devuelve el registro de project memory por defecto.
 * @returns Registro vacío con la versión de esquema actual.
 */
export function defaultRegistry(): ProjectMemoryRegistryFile {
  return { schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION, entries: [] };
}

/**
 * Parse a project memory registry JSON string and valida su esquema.
 * @param text Contenido JSON del registro.
 * @returns Registro parseado o el valor por defecto si es inválido.
 */
export function parseRegistryJson(text: string): ProjectMemoryRegistryFile {
  try {
    const v = JSON.parse(text) as Partial<ProjectMemoryRegistryFile>;
    if (v?.schemaVersion !== PROJECT_MEMORY_SCHEMA_VERSION || !Array.isArray(v.entries)) {
      return defaultRegistry();
    }
    const entries = v.entries
      .filter(
        (e): e is NonNullable<typeof e> =>
          e !== null &&
          typeof e === 'object' &&
          typeof (e as ProjectMemoryRegistryEntry).workspaceKey === 'string' &&
          typeof (e as ProjectMemoryRegistryEntry).storeRelativePath === 'string' &&
          typeof (e as ProjectMemoryRegistryEntry).lastSeenAt === 'number',
      )
      .map((e) => ({
        workspaceKey: (e as ProjectMemoryRegistryEntry).workspaceKey,
        storeRelativePath: (e as ProjectMemoryRegistryEntry).storeRelativePath,
        lastSeenAt: (e as ProjectMemoryRegistryEntry).lastSeenAt,
      }));
    return { schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION, entries };
  } catch {
    return defaultRegistry();
  }
}

/**
 * Devuelve el manifiesto de project memory por defecto para un workspace.
 * @param workspaceKey Clave del workspace para el manifiesto.
 * @param now Marca de tiempo actual en milisegundos.
 * @returns Manifiesto por defecto del workspace.
 */
export function defaultManifest(workspaceKey: string, now: number): ProjectMemoryManifestFile {
  return {
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    workspaceKey,
    updatedAtMs: now,
    quotas: {
      maxTotalBytes: 393_216,
      maxEntryBytes: 32_768,
    },
    stats: {
      entryCount: 0,
    },
  };
}

/**
 * Parsea un manifiesto JSON de project memory y lo normaliza según el esquema.
 * @param text Contenido JSON del manifiesto.
 * @param workspaceKey Clave del workspace usada si el manifiesto es inválido o faltante.
 * @returns Manifiesto parseado o el manifiesto por defecto.
 */
export function parseManifestJson(text: string, workspaceKey: string): ProjectMemoryManifestFile {
  try {
    const v = JSON.parse(text) as Partial<ProjectMemoryManifestFile>;
    if (v?.schemaVersion !== PROJECT_MEMORY_SCHEMA_VERSION) {
      return defaultManifest(workspaceKey, Date.now());
    }
    const base = defaultManifest(workspaceKey, Date.now());
    return {
      ...base,
      workspaceKey: typeof v.workspaceKey === 'string' ? v.workspaceKey : workspaceKey,
      updatedAtMs: typeof v.updatedAtMs === 'number' ? v.updatedAtMs : base.updatedAtMs,
      quotas:
        v.quotas &&
        typeof v.quotas === 'object' &&
        typeof (v.quotas as ProjectMemoryManifestFile['quotas']).maxTotalBytes === 'number' &&
        typeof (v.quotas as ProjectMemoryManifestFile['quotas']).maxEntryBytes === 'number'
          ? (v.quotas as ProjectMemoryManifestFile['quotas'])
          : base.quotas,
      stats:
        v.stats &&
        typeof v.stats === 'object' &&
        typeof (v.stats as ProjectMemoryManifestFile['stats']).entryCount === 'number'
          ? (v.stats as ProjectMemoryManifestFile['stats'])
          : base.stats,
    };
  } catch {
    return defaultManifest(workspaceKey, Date.now());
  }
}

/**
 * Devuelve el archivo de entradas de project memory por defecto.
 * @returns Archivo de entradas vacío con la versión de esquema actual.
 */
export function defaultEntries(): ProjectMemoryEntriesFile {
  return { schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION, items: [] };
}

/**
 * Parse a project memory entries JSON string y valida su esquema.
 * @param text Contenido JSON del archivo de entradas.
 * @returns Archivo de entradas parseado o el valor por defecto si es inválido.
 */
export function parseEntriesJson(text: string): ProjectMemoryEntriesFile {
  try {
    const v = JSON.parse(text) as Partial<ProjectMemoryEntriesFile>;
    if (v?.schemaVersion !== PROJECT_MEMORY_SCHEMA_VERSION || !Array.isArray(v.items)) {
      return defaultEntries();
    }
    return { schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION, items: v.items };
  } catch {
    return defaultEntries();
  }
}
