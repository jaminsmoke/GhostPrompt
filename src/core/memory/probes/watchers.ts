/**
 * Fase E: invalidación proactiva cuando cambian o desaparecen ficheros ya indexados.
 * Un watcher por ruta relativa indexada (no barrido del repo).
 */
import * as vscode from "vscode";

import { isProjectMemoryBootstrapStoredItem } from "../entries/bootstrap";
import { normalizeWorkspaceRelativePath } from "../io/path";
import { isProjectMemoryEditorIngestStoredItem } from "../entries/editor";
import { removeIndexedEntriesForRelativePath } from "../entries/mutation";
import type { ProjectMemoryStore } from "../Store";
import { workspaceKeyFromRootUriString } from "../io/key";

/**
 * Lee la configuración de los watchers de archivos de project memory.
 * @returns Objeto con el estado habilitado y el throttle en ms.
 */
export function readProjectMemoryFileWatcherConfig(): {
  enabled: boolean;
  throttleMs: number;
} {
  const cfg = vscode.workspace.getConfiguration("ghostPrompt");
  const memory = cfg.get<boolean>("projectMemoryEnabled", true);
  const watcherOn = cfg.get<boolean>("projectMemoryFileWatcherEnabled", true);
  const raw = cfg.get<number>("projectMemoryFileWatcherThrottleMs", 400);
  const throttleMs = Number.isFinite(raw)
    ? Math.max(50, Math.min(5000, Math.floor(raw)))
    : 400;
  return {
    enabled: memory && watcherOn,
    throttleMs,
  };
}

/**
 * Obtiene rutas relativas únicas para archivos indexados en project memory.
 * @param items Elementos indexados leídos desde entries.json.
 * @returns Lista de rutas relativas normalizadas.
 */
function collectIndexedRelativePaths(items: readonly unknown[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (isProjectMemoryBootstrapStoredItem(item)) {
      set.add(normalizeWorkspaceRelativePath(item.relativePath));
    } else if (isProjectMemoryEditorIngestStoredItem(item)) {
      set.add(normalizeWorkspaceRelativePath(item.relativePath));
    }
  }
  return [...set];
}

let boundStore: ProjectMemoryStore | undefined;
let watcherContext: vscode.ExtensionContext | undefined;
const activeWatchDisposables: vscode.Disposable[] = [];

const pendingInvalidateUris = new Map<string, vscode.Uri>();
let invalidateFlushTimer: ReturnType<typeof setTimeout> | undefined;

let scheduleRefreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Enlaza el watcher de paths indexados de project memory al contexto de la extensión.
 * @param context Contexto de la extensión de VS Code.
 * @param store Instancia de almacenamiento del proyecto.
 */
export function bindProjectMemoryIndexedPathWatcher(
  context: vscode.ExtensionContext,
  store: ProjectMemoryStore,
): void {
  watcherContext = context;
  boundStore = store;
  context.subscriptions.push({
    dispose: () => {
      disposeAllIndexedPathWatchers();
      watcherContext = undefined;
      boundStore = undefined;
    },
  });
}

/**
 * Elimina todos los watchers activos de paths indexados.
 */
function disposeAllIndexedPathWatchers(): void {
  while (activeWatchDisposables.length) {
    const d = activeWatchDisposables.pop();
    d?.dispose();
  }
}

/**
 * Persiste los elementos resultantes tras eliminar rutas indexadas inválidas.
 * @param store Instancia de almacenamiento del proyecto.
 * @param workspaceKey Clave del workspace para el store.
 * @param items Elementos filtrados a persistir.
 */
async function persistEntriesAfterStrip(
  store: ProjectMemoryStore,
  workspaceKey: string,
  items: unknown[],
): Promise<void> {
  await store.writeMemoryEntries(workspaceKey, items);
  const manifest = await store.readManifest(workspaceKey);
  await store.writeManifest({
    ...manifest,
    workspaceKey,
    updatedAtMs: Date.now(),
    stats: {
      ...manifest.stats,
      entryCount: items.length,
    },
  });
}

/**
 * Invalida las entradas indexadas para un URI que cambió o se eliminó.
 * @param store Instancia de almacenamiento del proyecto.
 * @param uri URI del archivo que cambió o se eliminó.
 */
async function invalidateIndexedUri(store: ProjectMemoryStore, uri: vscode.Uri): Promise<void> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder || uri.scheme !== "file") {
    return;
  }
  const relRaw = vscode.workspace.asRelativePath(uri, false);
  if (relRaw.startsWith("..")) {
    return;
  }
  const targetRel = normalizeWorkspaceRelativePath(relRaw);
  const workspaceKey = workspaceKeyFromRootUriString(folder.uri.toString());
  const items = await store.readEntriesJson(workspaceKey);
  const next = removeIndexedEntriesForRelativePath(items, targetRel);
  if (next.length === items.length) {
    return;
  }
  await persistEntriesAfterStrip(store, workspaceKey, next);
}

/**
 * Añade un URI a la cola de invalidación para procesarlo de forma agrupada.
 * @param uri URI del archivo que debe invalidarse.
 */
function queueInvalidate(uri: vscode.Uri): void {
  pendingInvalidateUris.set(uri.toString(), uri);
  const { throttleMs } = readProjectMemoryFileWatcherConfig();
  if (invalidateFlushTimer !== undefined) {
    clearTimeout(invalidateFlushTimer);
  }
  invalidateFlushTimer = setTimeout(() => {
    invalidateFlushTimer = undefined;
    void flushInvalidateQueue();
  }, throttleMs);
}

/**
 * Procesa la cola de invalidación acumulada y refresca los watchers.
 */
async function flushInvalidateQueue(): Promise<void> {
  const store = boundStore;
  if (!store) {
    pendingInvalidateUris.clear();
    return;
  }
  const uris = [...pendingInvalidateUris.values()];
  pendingInvalidateUris.clear();
  for (const uri of uris) {
    await invalidateIndexedUri(store, uri);
  }
  await refreshProjectMemoryIndexedPathWatchers();
}

/**
 * Recrea watchers sólo para rutas presentes en `entries.json` de cada carpeta abierta.
 * @returns Promise que se resuelve cuando los watchers han sido recreados.
 */
export async function refreshProjectMemoryIndexedPathWatchers(): Promise<void> {
  disposeAllIndexedPathWatchers();
  const store = boundStore;
  if (!store) {
    return;
  }
  const cfg = readProjectMemoryFileWatcherConfig();
  if (!cfg.enabled) {
    return;
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const folder of folders) {
    const workspaceKey = workspaceKeyFromRootUriString(folder.uri.toString());
    let items: unknown[];
    try {
      items = await store.readEntriesJson(workspaceKey);
    } catch {
      continue;
    }
    const paths = collectIndexedRelativePaths(items);
    for (const rel of paths) {
      const pattern = new vscode.RelativePattern(folder, rel);
      const watcher = vscode.workspace.createFileSystemWatcher(pattern, true, false, false);
      activeWatchDisposables.push(watcher);
      activeWatchDisposables.push(
        watcher.onDidChange((uri) => {
          queueInvalidate(uri);
        }),
      );
      activeWatchDisposables.push(
        watcher.onDidDelete((uri) => {
          queueInvalidate(uri);
        }),
      );
    }
  }
}

/** Tras persistir entradas nuevas, reprogramar watchers (debounce corto). */
export function scheduleIndexedPathWatcherRefresh(): void {
  if (!watcherContext) {
    return;
  }
  if (scheduleRefreshTimer !== undefined) {
    clearTimeout(scheduleRefreshTimer);
  }
  scheduleRefreshTimer = setTimeout(() => {
    scheduleRefreshTimer = undefined;
    void refreshProjectMemoryIndexedPathWatchers();
  }, 80);
}
