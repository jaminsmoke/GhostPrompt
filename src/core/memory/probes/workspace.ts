import * as vscode from 'vscode';

import { sha256HexBytes } from '../projectBootstrapContext';

/**
 * Comprueba el estado actual de una lista de rutas relativas en el workspace.
 * @param {{ workspaceRootUri: vscode.Uri; relativePaths: readonly string[] }} params Parámetros de la operación de sondeo.
 * @param {vscode.Uri} params.workspaceRootUri URI de la raíz del workspace.
 * @param {readonly string[]} params.relativePaths Rutas relativas a inspeccionar.
 * @returns {Promise<Partial<Record<string, { mtimeMs: number; sha256: string }>>>} Un mapeo parcial de rutas a metadatos de archivo (mtime y hash).
 */
export async function probeWorkspaceRelativePaths(params: {
  workspaceRootUri: vscode.Uri;
  relativePaths: readonly string[];
}): Promise<Partial<Record<string, { mtimeMs: number; sha256: string }>>> {
  const { workspaceRootUri, relativePaths } = params;
  const out: Partial<Record<string, { mtimeMs: number; sha256: string }>> = {};
  for (const rel of relativePaths) {
    try {
      const uri = vscode.Uri.joinPath(
        workspaceRootUri,
        ...rel.split('/').filter((s) => s.length > 0),
      );
      const fileStat = await vscode.workspace.fs.stat(uri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      out[rel] = {
        mtimeMs: fileStat.mtime,
        sha256: sha256HexBytes(bytes),
      };
    } catch {
      // omitido
    }
  }
  return out;
}
