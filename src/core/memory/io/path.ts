/** Normalización de rutas relativas al workspace (sin dependencia de `vscode`). */

export function normalizeWorkspaceRelativePath(rel: string): string {
  return rel.replace(/\\/g, "/").trim();
}

export function workspaceRelativePathsMatch(a: string, b: string): boolean {
  const na = normalizeWorkspaceRelativePath(a);
  const nb = normalizeWorkspaceRelativePath(b);
  if (process.platform === "win32") {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}
