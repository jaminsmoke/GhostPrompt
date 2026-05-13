import { createHash } from "node:crypto";

/**
 * Clave estable por raíz de workspace (`WorkspaceFolder.uri.toString()` canónico de VS Code).
 */
export function workspaceKeyFromRootUriString(rootUriCanonical: string): string {
  return createHash("sha256").update(rootUriCanonical, "utf8").digest("hex");
}
