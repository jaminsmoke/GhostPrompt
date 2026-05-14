import * as path from 'node:path';

import * as vscode from 'vscode';

import { sha256HexBytes, truncateProjectCardText } from '../../context/projectBootstrapContext';
import {
  readEditorIngestConfig,
  PROJECT_EDITOR_CARD_MAX_CHARS,
  normalizeWorkspaceRelativePath,
  pathLikelyExcludedForEditorIngest,
} from './settings';
import { applyEditorIngestLruEviction } from './lru';
import {
  isProjectMemoryEditorIngestStoredItem,
  mergeEntriesReplacingEditorSubset,
} from '../entries/editor';
import {
  PROJECT_EDITOR_INGEST_ENTRY_KIND,
  type ProjectMemoryEditorIngestStoredItem,
} from '../types';
import { scheduleIndexedPathWatcherRefresh } from '../probes/watchers';
import type { ProjectMemoryStore } from '../Store';
import { workspaceKeyFromRootUriString } from '../io/key';

/**
 * Ingierir el documento activo del editor en project memory si aplica.
 * @param store Store de project memory donde se guardarán los datos.
 * @param editor Editor activo de VS Code o undefined.
 * @returns Promise que se resuelve cuando la ingestión termina.
 */
export async function ingestActiveEditorDocument(
  store: ProjectMemoryStore,
  editor: vscode.TextEditor | undefined,
): Promise<void> {
  const cfg = readEditorIngestConfig();
  if (!cfg.includeEditorIngest || !editor) {
    return;
  }

  const doc = editor.document;
  if (doc.isUntitled || doc.uri.scheme !== 'file') {
    return;
  }

  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (!folder) {
    return;
  }

  const relRaw = vscode.workspace.asRelativePath(doc.uri, false);
  if (relRaw.startsWith('..')) {
    return;
  }
  const relativePath = normalizeWorkspaceRelativePath(relRaw);

  if (pathLikelyExcludedForEditorIngest(relativePath, cfg.excludePathPatterns)) {
    return;
  }

  const ext = path.extname(doc.uri.fsPath).toLowerCase();
  if (!cfg.allowedExtensions.has(ext)) {
    return;
  }

  let stat: vscode.FileStat;
  try {
    stat = await vscode.workspace.fs.stat(doc.uri);
  } catch {
    return;
  }
  if (stat.size > cfg.maxFileBytes) {
    return;
  }

  let bytes: Uint8Array;
  try {
    bytes = await vscode.workspace.fs.readFile(doc.uri);
  } catch {
    return;
  }

  const hash = sha256HexBytes(bytes);
  const mtime = stat.mtime;
  const workspaceRootStr = folder.uri.toString();
  const workspaceKey = workspaceKeyFromRootUriString(workspaceRootStr);
  await store.ensureStoresDirExistsForWorkspaceRoot(workspaceRootStr);

  const rawItems = await store.readEntriesJson(workspaceKey);
  const existing = rawItems
    .filter(isProjectMemoryEditorIngestStoredItem)
    .find((e) => e.relativePath === relativePath);

  const now = Date.now();

  if (existing && existing.sourceMtimeMs === mtime && existing.sourceSha256 === hash) {
    const touched = rawItems.map((item) => {
      if (!isProjectMemoryEditorIngestStoredItem(item)) {
        return item;
      }
      if (item.relativePath !== relativePath) {
        return item;
      }
      return { ...item, lastUsedAtMs: now };
    });
    const editors = touched.filter(isProjectMemoryEditorIngestStoredItem);
    const evicted = applyEditorIngestLruEviction(editors, cfg.maxEditorSources, cfg.maxTotalBytes);
    const merged = mergeEntriesReplacingEditorSubset(touched, evicted);
    await store.writeMemoryEntries(workspaceKey, merged);
    await bumpManifest(store, workspaceKey, merged.length);
    scheduleIndexedPathWatcherRefresh();
    return;
  }

  const sliceLen = Math.min(bytes.length, cfg.maxEntryBytes);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, sliceLen));
  const compact = text.replace(/\s+/g, ' ').trim();
  const excerpt = truncateProjectCardText(compact, PROJECT_EDITOR_CARD_MAX_CHARS);
  const promptLine = `Editor excerpt (${relativePath}): ${excerpt}`;

  const newItem: ProjectMemoryEditorIngestStoredItem = {
    kind: PROJECT_EDITOR_INGEST_ENTRY_KIND,
    relativePath,
    promptLine,
    sourceMtimeMs: mtime,
    sourceSha256: hash,
    indexedAtMs: now,
    lastUsedAtMs: now,
  };

  const editorsPrev = rawItems
    .filter(isProjectMemoryEditorIngestStoredItem)
    .filter((e) => e.relativePath !== relativePath);
  const nextEditors = [...editorsPrev, newItem];
  const evicted = applyEditorIngestLruEviction(
    nextEditors,
    cfg.maxEditorSources,
    cfg.maxTotalBytes,
  );
  const merged = mergeEntriesReplacingEditorSubset(rawItems, evicted);
  await store.writeMemoryEntries(workspaceKey, merged);
  await bumpManifest(store, workspaceKey, merged.length);
  scheduleIndexedPathWatcherRefresh();
}

/**
 * Actualiza el manifiesto del workspace con el nuevo recuento de entradas.
 * @param store Store de project memory donde se encuentra el manifiesto.
 * @param workspaceKey Clave del workspace cuyo manifiesto se actualiza.
 * @param entryCount Número de entradas persistidas tras la operación.
 */
async function bumpManifest(
  store: ProjectMemoryStore,
  workspaceKey: string,
  entryCount: number,
): Promise<void> {
  const manifest = await store.readManifest(workspaceKey);
  await store.writeManifest({
    ...manifest,
    workspaceKey,
    updatedAtMs: Date.now(),
    stats: {
      ...manifest.stats,
      entryCount,
    },
  });
}
