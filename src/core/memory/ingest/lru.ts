import type { ProjectMemoryEditorIngestStoredItem } from "../types";

/**
 * Calcula el tamaño aproximado en bytes de una entrada editor-ingest.
 * @param e Entrada editor-ingest a medir.
 * @returns Tamaño aproximado en bytes de la entrada.
 */
function entryApproxByteSize(e: ProjectMemoryEditorIngestStoredItem): number {
  return Buffer.byteLength(JSON.stringify(e), "utf8");
}

/**
 * Reduce entradas editor-ingest por **recuento** y **bytes** totales aproximados.
 * Descarta primero por `lastUsedAtMs` ascendente (LRU).
 * @param entries Entradas editor-ingest candidatas para evicción.
 * @param maxEntries Límite máximo de entradas a conservar.
 * @param maxTotalBytes Límite máximo de bytes aproximados a conservar.
 * @returns Entradas supervivientes tras evicción LRU.
 */
export function applyEditorIngestLruEviction(
  entries: readonly ProjectMemoryEditorIngestStoredItem[],
  maxEntries: number,
  maxTotalBytes: number,
): ProjectMemoryEditorIngestStoredItem[] {
  if (entries.length === 0) {
    return [];
  }
  let candidate = [...entries].sort((a, b) => {
    const d = a.lastUsedAtMs - b.lastUsedAtMs;
    if (d !== 0) {
      return d;
    }
    return a.relativePath.localeCompare(b.relativePath, "en", { sensitivity: "base" });
  });

  while (candidate.length > maxEntries) {
    candidate.shift();
  }

  let total = candidate.reduce((sum, e) => sum + entryApproxByteSize(e), 0);
  while (total > maxTotalBytes && candidate.length > 0) {
    candidate.shift();
    total = candidate.reduce((sum, e) => sum + entryApproxByteSize(e), 0);
  }

  return [...candidate].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "en", { sensitivity: "base" }),
  );
}
