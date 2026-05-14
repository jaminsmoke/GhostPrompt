import {
  PROJECT_EDITOR_INGEST_ENTRY_KIND,
  type ProjectMemoryEditorIngestStoredItem,
} from "../types";

/**
 * Comprueba si un valor coincide con el contrato de item editor-ingest de project memory.
 * @param x Valor sin tipar a validar.
 * @returns True si el valor es un item editor-ingest válido.
 */
export function isProjectMemoryEditorIngestStoredItem(
  x: unknown,
): x is ProjectMemoryEditorIngestStoredItem {
  if (
    x === null ||
    typeof x !== "object" ||
    (x as { kind?: unknown }).kind !== PROJECT_EDITOR_INGEST_ENTRY_KIND
  ) {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    typeof o.relativePath === "string" &&
    o.relativePath.trim().length > 0 &&
    typeof o.promptLine === "string" &&
    typeof o.sourceMtimeMs === "number" &&
    Number.isFinite(o.sourceMtimeMs) &&
    typeof o.sourceSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(o.sourceSha256) &&
    typeof o.indexedAtMs === "number" &&
    Number.isFinite(o.indexedAtMs) &&
    typeof o.lastUsedAtMs === "number" &&
    Number.isFinite(o.lastUsedAtMs)
  );
}

/**
 * Filtra items editor-ingest que siguen siendo válidos según los probes de archivos.
 * @param items Items editor-ingest almacenados a validar.
 * @param probes Resultado de sondeo de rutas con mtime/hash actuales.
 * @returns Items editor-ingest válidos tras la validación.
 */
export function pruneEditorIngestAgainstFileProbes(
  items: ProjectMemoryEditorIngestStoredItem[],
  probes: Readonly<
    Partial<Record<string, { readonly mtimeMs: number; readonly sha256: string }>>
  >,
): ProjectMemoryEditorIngestStoredItem[] {
  return items.filter((item) => {
    const probe = probes[item.relativePath];
    return (
      probe !== undefined &&
      probe.mtimeMs === item.sourceMtimeMs &&
      probe.sha256 === item.sourceSha256
    );
  });
}

/**
 * Reemplaza todo el subconjunto editor-ingest por nextEditors; conserva otros items.
 * @param existingItems Items existentes en el store, incluyendo editor-ingest y otros.
 * @param nextEditors Nuevo conjunto de items editor-ingest a persistir.
 * @returns Items con el subconjunto editor-ingest actualizado.
 */
export function mergeEntriesReplacingEditorSubset(
  existingItems: readonly unknown[],
  nextEditors: readonly ProjectMemoryEditorIngestStoredItem[],
): unknown[] {
  const other = existingItems.filter((x) => !isProjectMemoryEditorIngestStoredItem(x));
  const sorted = [...nextEditors].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "en", { sensitivity: "base" }),
  );
  return [...other, ...sorted];
}
