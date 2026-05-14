/** Normalización de rutas relativas al workspace (sin dependencia de `vscode`). */

/**
 * Normaliza una ruta de workspace a formato de barra normalizada.
 * @param rel Ruta relativa al workspace.
 * @returns Ruta con barras `/` y sin espacios en los extremos.
 */
export function normalizeWorkspaceRelativePath(rel: string): string {
  return rel.replace(/\\/g, "/").trim();
}

/**
 * Compara dos rutas de workspace normalizadas respetando mayúsculas en Unix.
 * @param a Primera ruta relativa.
 * @param b Segunda ruta relativa.
 * @returns True si las rutas coinciden tras normalizar y aplicar sensibilidad según plataforma.
 */
export function workspaceRelativePathsMatch(a: string, b: string): boolean {
  const na = normalizeWorkspaceRelativePath(a);
  const nb = normalizeWorkspaceRelativePath(b);
  if (process.platform === "win32") {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}
