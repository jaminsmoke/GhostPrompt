import * as vscode from "vscode";

import { type ProjectBootstrapPiece } from '../core/context/projectBootstrapContext';
import { readEditorIngestConfig } from "./editorIngestSettings";
import { applyEditorIngestLruEviction } from "./editorIngestLru";
import {
  mergeEntriesReplacingBootstrapSubset,
  mergeValidatedBootstrapWithLive,
  isProjectMemoryBootstrapStoredItem,
} from "./bootstrapStoredHelpers";
import {
  isProjectMemoryEditorIngestStoredItem,
  mergeEntriesReplacingEditorSubset,
  pruneEditorIngestAgainstFileProbes,
} from "./editorStoredHelpers";
import type { ProjectMemoryBootstrapStoredItem } from "./projectMemoryTypes";
import { PROJECT_BOOTSTRAP_ENTRY_KIND } from "./projectMemoryTypes";
import type { ProjectMemoryStore } from "./ProjectMemoryStore";
import { scheduleIndexedPathWatcherRefresh } from "./indexedPathsFileWatcher";
import { workspaceKeyFromRootUriString } from "./workspaceKey";
import { probeWorkspaceRelativePaths } from "./workspaceFileProbes";

/** @deprecated usar {@link ProjectMemoryReconcileSnapshot} */
export type ProjectBootstrapReconcileSnapshot = ProjectMemoryReconcileSnapshot;

export interface ProjectMemoryReconcileSnapshot {
  workspaceKey: string;
  mergedItems: unknown[];
  /** Bootstrap + (opcional) editor-ingest validados. */
  promptLines: readonly string[];
}

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

async function probesForStoredBootstrapAtWorkspace(params: {
  workspaceRootUri: vscode.Uri;
  items: readonly ProjectMemoryBootstrapStoredItem[];
}): Promise<Partial<Record<string, { mtimeMs: number; sha256: string }>>> {
  return probeWorkspaceRelativePaths({
    workspaceRootUri: params.workspaceRootUri,
    relativePaths: params.items.map((i) => i.relativePath),
  });
}

/** Lee store + bootstrap vivos + validación editor-ingest → líneas LM + ítems persistibles. */
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
        .sort((a, b) =>
          a.relativePath.localeCompare(b.relativePath, "en", { sensitivity: "base" }),
        )
        .map((e) => e.promptLine)
    : [];

  const promptLines = [...bootstrapPromptLines, ...editorPromptLines];

  return {
    workspaceKey,
    mergedItems: mergedFinal,
    promptLines,
  };
}

/** @deprecated usar {@link reconcileProjectMemoryForSuggest} */
export async function reconcileProjectBootstrapForSuggest(
  params: Parameters<typeof reconcileProjectMemoryForSuggest>[0],
): Promise<ProjectMemoryReconcileSnapshot> {
  return reconcileProjectMemoryForSuggest(params);
}

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
