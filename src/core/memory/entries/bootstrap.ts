import { PROJECT_BOOTSTRAP_ENTRY_KIND, type ProjectMemoryBootstrapStoredItem } from '../types';

/**
 * Comprueba si un valor coincide con el contrato de item bootstrap de project memory.
 * @param x Valor sin tipar a validar.
 * @returns True si el valor es un item bootstrap válido.
 */
export function isProjectMemoryBootstrapStoredItem(
  x: unknown,
): x is ProjectMemoryBootstrapStoredItem {
  if (
    x === null ||
    typeof x !== 'object' ||
    (x as { kind?: unknown }).kind !== PROJECT_BOOTSTRAP_ENTRY_KIND
  ) {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    typeof o.relativePath === 'string' &&
    o.relativePath.trim().length > 0 &&
    typeof o.promptLine === 'string' &&
    typeof o.sourceMtimeMs === 'number' &&
    Number.isFinite(o.sourceMtimeMs) &&
    typeof o.sourceSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(o.sourceSha256)
  );
}

/**
 * Elimina ítems bootstrap obsoletos (fichero borrado o contenido tocado vs mtime/hash).
 * @param items Ítems bootstrap almacenados a validar.
 * @param probes Resultado de sondeo de rutas con mtime/hash actuales.
 * @returns Ítems bootstrap que siguen siendo válidos según probes.
 */
export function pruneBootstrapStoredAgainstFileProbes(
  items: ProjectMemoryBootstrapStoredItem[],
  probes: Readonly<Partial<Record<string, { readonly mtimeMs: number; readonly sha256: string }>>>,
): ProjectMemoryBootstrapStoredItem[] {
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
 * Supervivientes validados contra `probes` + piezas vivas (`live` gana si comparten `relativePath`).
 * @param prevBootstrap Items bootstrap previos almacenados.
 * @param probes Resultado de sondeo de rutas para los ítems previos.
 * @param liveAsStored Piezas bootstrap vivas convertidas a item persistible.
 * @returns Bootstrap mergeado con prioridad de piezas vivas.
 */
export function mergeValidatedBootstrapWithLive(
  prevBootstrap: readonly ProjectMemoryBootstrapStoredItem[],
  probes: Readonly<Partial<Record<string, { readonly mtimeMs: number; readonly sha256: string }>>>,
  liveAsStored: readonly ProjectMemoryBootstrapStoredItem[],
): ProjectMemoryBootstrapStoredItem[] {
  const validatedPrev = pruneBootstrapStoredAgainstFileProbes([...prevBootstrap], probes);
  const livePaths = new Set(liveAsStored.map((s) => s.relativePath));
  const survivors = validatedPrev.filter((e) => !livePaths.has(e.relativePath));
  const merged = [...survivors, ...liveAsStored];
  return [...merged].sort((a, b) => bootstrapStoredSortComparison(a.relativePath, b.relativePath));
}

/**
 * Compara rutas bootstrap para orden estable en project memory.
 * @param a Primera ruta relativa de bootstrap.
 * @param b Segunda ruta relativa de bootstrap.
 * @returns Valor de comparación para ordenar las rutas.
 */
function bootstrapStoredSortComparison(a: string, b: string): number {
  const d = bootstrapRelativePathBucketStable(a) - bootstrapRelativePathBucketStable(b);
  if (d !== 0) {
    return d;
  }
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

/**
 * Calcula un bucket estable para ordenar rutas bootstrap con prioridad a README/package.
 * @param rel Ruta relativa de bootstrap.
 * @returns Bucket numérico para orden estable.
 */
function bootstrapRelativePathBucketStable(rel: string): number {
  const lower = rel.toLowerCase();
  if (lower === 'package.json') {
    return 2;
  }
  const base = lower.replace(/^.*[/\\]/, '');
  return base.startsWith('readme') ? 1 : 0;
}

/**
 * Reemplaza todo el subconjunto `bootstrap` por `nextBootstrap`; conserva otros `items`.
 * @param existingItems Items existentes en el store, incluyendo bootstrap y otros tipos.
 * @param nextBootstrap Nuevo conjunto de items bootstrap a persistir.
 * @returns Items con bootstrap reemplazado.
 */
export function mergeEntriesReplacingBootstrapSubset(
  existingItems: readonly unknown[],
  nextBootstrap: readonly ProjectMemoryBootstrapStoredItem[],
): unknown[] {
  const other = existingItems.filter((x) => !isProjectMemoryBootstrapStoredItem(x));
  const bootstrapSorted = [...nextBootstrap].sort((a, b) =>
    bootstrapStoredSortComparison(a.relativePath, b.relativePath),
  );
  return [...other, ...bootstrapSorted];
}
