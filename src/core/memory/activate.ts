/**
 * Registro en `activate`: layout en `globalStorageUri`, toque de raíces abiertas, GC y comando clear.
 */
import * as path from "node:path";

import * as vscode from "vscode";

import { ingestActiveEditorDocument } from "./ingest/document";
import {
  bindProjectMemoryIndexedPathWatcher,
  refreshProjectMemoryIndexedPathWatchers,
} from "./probes/watchers";
import { NodeProjectMemoryFs } from "./io/fs";
import { ProjectMemoryStore } from "./Store";
import { PROJECT_MEMORY_REL_SEGMENTS } from "./types";

function clampTtlDays(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 30;
  }
  return Math.max(1, Math.min(3650, Math.floor(raw)));
}

export function readProjectMemoryUnusedStoreTtlDays(): number {
  const v = vscode.workspace
    .getConfiguration("ghostPrompt")
    .get<number>("projectMemoryUnusedStoreTtlDays", 30);
  return clampTtlDays(v);
}

export function getProjectMemoryBaseDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, ...PROJECT_MEMORY_REL_SEGMENTS);
}

export function pickWorkspaceFolderForProjectMemory():
  | vscode.WorkspaceFolder
  | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri;
  if (uri) {
    const wf = vscode.workspace.getWorkspaceFolder(uri);
    if (wf) {
      return wf;
    }
  }
  return vscode.workspace.workspaceFolders?.[0];
}

async function touchOpenWorkspaceRoots(store: ProjectMemoryStore): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return;
  }
  const now = Date.now();
  for (const f of folders) {
    await store.touchWorkspaceRoot(f.uri.toString(), now);
  }
}

export function registerProjectMemory(context: vscode.ExtensionContext): ProjectMemoryStore {
  const baseDir = getProjectMemoryBaseDir(context.globalStorageUri.fsPath);
  const store = new ProjectMemoryStore(baseDir, new NodeProjectMemoryFs());

  bindProjectMemoryIndexedPathWatcher(context, store);

  const runLifecycle = async (): Promise<void> => {
    try {
      await store.ensureBaseLayout();
      await touchOpenWorkspaceRoots(store);
      await runGarbageCollect(store);
      await refreshProjectMemoryIndexedPathWatchers();
    } catch (e) {
      console.error("[GhostPrompt] projectMemory lifecycle failed", e);
    }
  };

  async function runGarbageCollect(s: ProjectMemoryStore): Promise<void> {
    const ttlDays = readProjectMemoryUnusedStoreTtlDays();
    await s.garbageCollectUnusedStores(ttlDays * 86_400_000, Date.now());
  }

  void runLifecycle();

  let ingestTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleIngest = (editor: vscode.TextEditor | undefined): void => {
    if (ingestTimer !== undefined) {
      clearTimeout(ingestTimer);
    }
    ingestTimer = setTimeout(() => {
      ingestTimer = undefined;
      void ingestActiveEditorDocument(store, editor);
    }, 400);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      scheduleIngest(ed ?? vscode.window.activeTextEditor);
    }),
  );
  scheduleIngest(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void (async () => {
        try {
          await touchOpenWorkspaceRoots(store);
          await runGarbageCollect(store);
          await refreshProjectMemoryIndexedPathWatchers();
        } catch (e) {
          console.error("[GhostPrompt] projectMemory workspace-folder sync failed", e);
        }
      })();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("ghostPrompt.projectMemoryEnabled") ||
        e.affectsConfiguration("ghostPrompt.projectMemoryFileWatcherEnabled") ||
        e.affectsConfiguration("ghostPrompt.projectMemoryFileWatcherThrottleMs")
      ) {
        void refreshProjectMemoryIndexedPathWatchers();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ghostPrompt.clearProjectMemoryThisWorkspace",
      async () => {
        const folder = pickWorkspaceFolderForProjectMemory();
        if (!folder) {
          void vscode.window.showWarningMessage(
            "GhostPrompt: no hay carpeta de workspace para borrar la memoria de proyecto.",
          );
          return;
        }
        const had = await store.clearWorkspaceRoot(folder.uri.toString());
        if (had) {
          void vscode.window.showInformationMessage(
            "GhostPrompt: memoria de proyecto eliminada para esta carpeta del workspace.",
          );
        } else {
          void vscode.window.showInformationMessage(
            "GhostPrompt: no había memoria persistida para esta carpeta.",
          );
        }
      },
    ),
  );

  return store;
}
