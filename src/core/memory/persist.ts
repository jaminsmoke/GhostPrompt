import * as vscode from 'vscode';

import { type ProjectBootstrapPiece } from './projectBootstrapContext';
import { readEditorIngestConfig } from './ingest/settings';
import { applyEditorIngestLruEviction } from './ingest/lru';
import {
  isProjectMemoryBootstrapStoredItem,
  mergeEntriesReplacingBootstrapSubset,
  mergeValidatedBootstrapWithLive,
} from './entries/bootstrap';
import {
  isProjectMemoryEditorIngestStoredItem,
  mergeEntriesReplacingEditorSubset,
  pruneEditorIngestAgainstFileProbes,
} from './entries/editor';
import type { ProjectMemoryBootstrapStoredItem } from './types';
import { PROJECT_BOOTSTRAP_ENTRY_KIND } from './types';
import type { ProjectMemoryStore } from './Store';
import { scheduleIndexedPathWatcherRefresh } from './probes/watchers';
import { workspaceKeyFromRootUriString } from './io/key';
import { probeWorkspaceRelativePaths } from './probes/workspace';

/** @deprecated Usar {@link ProjectMemoryReconcileSnapshot}. */
export type ProjectBootstrapReconcileSnapshot = ProjectMemoryReconcileSnapshot;

export interface ProjectMemoryReconcileSnapshot {
  workspaceKey: string;
  mergedItems: unknown[];
  /** Bootstrap + (opcional) editor-ingest validados. */
  promptLines: readonly string[];
}

/**
 * Convierte un fragmento bootstrap en un item persistible para project memory.
 * @param {ProjectBootstrapPiece} piece Fragmento de bootstrap extraído del proyecto.
 * @returns {ProjectMemoryBootstrapStoredItem} Item almacenable en la memoria del proyecto.
 */
export function bootstrapPieceToStoredItem(
  piece: ProjectBootstrapPiece,
): ProjectMemoryBootstrapStoredItem {
  return {
    kind: PROJECT_BOOTSTRAP_ENTRY_KIND,
    relativePath: piece.relativePath,
    promptLine: piece.promptLine,
    sourceMtimeMs: piece.sourceMtimeMs,
    sourceSha256: piece.sourceSha256,
  };
}

/**
 * Sondea los paths relativos de bootstrap almacenados para el workspace actual.
 * @param {{ workspaceRootUri: vscode.Uri; items: readonly ProjectMemoryBootstrapStoredItem[]; }} params Parámetros de sondeo de bootstrap.
 * @param {vscode.Uri} params.workspaceRootUri URI raíz del workspace.
 * @param {readonly ProjectMemoryBootstrapStoredItem[]} params.items Items bootstrap almacenados a sondear.
 * @returns {Promise<Partial<Record<string, { mtimeMs: number; sha256: string }>>>} Un mapeo parcial de rutas a metadatos de archivos existentes.
 */
async function probesForStoredBootstrapAtWorkspace(params: {
  workspaceRootUri: vscode.Uri;
  items: readonly ProjectMemoryBootstrapStoredItem[];
}): Promise<Partial<Record<string, { mtimeMs: number; sha256: string }>>> {
  return probeWorkspaceRelativePaths({
    workspaceRootUri: params.workspaceRootUri,
    relativePaths: params.items.map((i) => i.relativePath),
  });
}

/**
 * Lee el store y reconcilia bootstrap + editor-ingest con el estado actual del workspace.
 * @param {{ store: ProjectMemoryStore; workspaceRootUriString: string; workspaceFolderUri: vscode.Uri; livePieces: readonly ProjectBootstrapPiece[]; }} params Parámetros de reconciliación de la memoria del proyecto.
 * @param {ProjectMemoryStore} params.store Instancia de almacenamiento del proyecto.
 * @param {string} params.workspaceRootUriString URI canónico del workspace como cadena.
 * @param {vscode.Uri} params.workspaceFolderUri URI de la carpeta del workspace.
 * @param {readonly ProjectBootstrapPiece[]} params.livePieces Fragmentos activos de bootstrap que deben considerarse.
 * @returns {Promise<ProjectMemoryReconcileSnapshot>} Snapshot reconciliada con líneas de prompt y elementos persistibles.
 */
export async function reconcileProjectMemoryForSuggest(params: {
  store: ProjectMemoryStore;
  workspaceRootUriString: string;
  workspaceFolderUri: vscode.Uri;
  livePieces: readonly ProjectBootstrapPiece[];
}): Promise<ProjectMemoryReconcileSnapshot> {
  const { store, workspaceRootUriString, workspaceFolderUri, livePieces } = params;
  const cfg = readEditorIngestConfig();
  const workspaceKey = workspaceKeyFromRootUriString(workspaceRootUriString);
  await store.ensureStoresDirExistsForWorkspaceRoot(workspaceRootUriString);

  const rawItems = await store.readEntriesJson(workspaceKey);
  const prevBootstrap = rawItems.filter(isProjectMemoryBootstrapStoredItem);
  const probesB = await probesForStoredBootstrapAtWorkspace({
    workspaceRootUri: workspaceFolderUri,
    items: prevBootstrap,
  });
  const liveStored = livePieces.map(bootstrapPieceToStoredItem);
  const nextBootstrap = mergeValidatedBootstrapWithLive(prevBootstrap, probesB, liveStored);
  const mergedAfterBootstrap = mergeEntriesReplacingBootstrapSubset(rawItems, nextBootstrap);

  const prevEditor = mergedAfterBootstrap.filter(isProjectMemoryEditorIngestStoredItem);
  const probesE = await probeWorkspaceRelativePaths({
    workspaceRootUri: workspaceFolderUri,
    relativePaths: prevEditor.map((e) => e.relativePath),
  });
  const validEditor = pruneEditorIngestAgainstFileProbes(prevEditor, probesE);

  const evictedEditor = applyEditorIngestLruEviction(
    validEditor,
    cfg.maxEditorSources,
    cfg.maxTotalBytes,
  );

  const now = Date.now();
  const persistedEditor = evictedEditor.map((e) => ({ ...e, lastUsedAtMs: now }));

  const mergedFinal = mergeEntriesReplacingEditorSubset(mergedAfterBootstrap, persistedEditor);

  const bootstrapPromptLines = nextBootstrap.map((x) => x.promptLine);
  const editorPromptLines = cfg.includeEditorIngest
    ? [...persistedEditor]
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en', { sensitivity: 'base' }))
        .map((e) => e.promptLine)
    : [];

  const promptLines = [...bootstrapPromptLines, ...editorPromptLines];

  return {
    workspaceKey,
    mergedItems: mergedFinal,
    promptLines,
  };
}

/**
 * Reconciliación legacy de bootstrap. Usar {@link reconcileProjectMemoryForSuggest} en su lugar.
 * @param {Parameters<typeof reconcileProjectMemoryForSuggest>[0]} params Parámetros de reconciliación de la memoria del proyecto.
 * @deprecated Usar {@link reconcileProjectMemoryForSuggest}.
 * @returns {Promise<ProjectMemoryReconcileSnapshot>} Snapshot reconciliada (deprecated).
 */
export async function reconcileProjectBootstrapForSuggest(
  params: Parameters<typeof reconcileProjectMemoryForSuggest>[0],
): Promise<ProjectMemoryReconcileSnapshot> {
  return reconcileProjectMemoryForSuggest(params);
}

/**
 * Escribe en disco el snapshot reconciliado de proyecto y actualiza el manifiesto.
 * @param {{ store: ProjectMemoryStore; workspaceKey: string; mergedItems: unknown[]; }} params Parámetros para persistir el snapshot.
 * @param {ProjectMemoryStore} params.store Instancia de almacenamiento del proyecto.
 * @param {string} params.workspaceKey Clave del workspace usada en el store.
 * @param {unknown[]} params.mergedItems Elementos reconciliados que se deben persistir.
 * @returns {Promise<void>} Promise que se resuelve cuando el snapshot está escrito.
 */
export async function writeReconciledProjectBootstrapSnapshot(params: {
  store: ProjectMemoryStore;
  workspaceKey: string;
  mergedItems: unknown[];
}): Promise<void> {
  const { store, workspaceKey, mergedItems } = params;
  await store.writeMemoryEntries(workspaceKey, mergedItems);
  const manifest = await store.readManifest(workspaceKey);
  await store.writeManifest({
    ...manifest,
    workspaceKey,
    updatedAtMs: Date.now(),
    stats: {
      ...manifest.stats,
      entryCount: mergedItems.length,
    },
  });
  scheduleIndexedPathWatcherRefresh();
}

/**
 * Persiste el snapshot de bootstrap del proyecto al store y reprograma watchers.
 * @param {{ store: ProjectMemoryStore; workspaceRootUriString: string; workspaceFolderUri: vscode.Uri; livePieces: readonly ProjectBootstrapPiece[]; }} params Parámetros para persistir el snapshot.
 * @param {ProjectMemoryStore} params.store Instancia de almacenamiento del proyecto.
 * @param {string} params.workspaceRootUriString URI canónico del workspace como cadena.
 * @param {vscode.Uri} params.workspaceFolderUri URI de la carpeta del workspace.
 * @param {readonly ProjectBootstrapPiece[]} params.livePieces Fragmentos activos de bootstrap que se deben persistir.
 * @returns {Promise<void>} Promise que se resuelve cuando el snapshot se ha persistido.
 */
export async function persistProjectBootstrapSnapshot(params: {
  store: ProjectMemoryStore;
  workspaceRootUriString: string;
  workspaceFolderUri: vscode.Uri;
  livePieces: readonly ProjectBootstrapPiece[];
}): Promise<void> {
  const snap = await reconcileProjectMemoryForSuggest(params);
  await writeReconciledProjectBootstrapSnapshot({
    store: params.store,
    workspaceKey: snap.workspaceKey,
    mergedItems: snap.mergedItems,
  });
}
