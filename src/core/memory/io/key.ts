import { createHash } from 'node:crypto';

/**
 * Clave estable por raíz de workspace (`WorkspaceFolder.uri.toString()` canónico de VS Code).
 * @param {string} rootUriCanonical URI canónico del workspace a partir del cual se genera la clave.
 * @returns {string} Hash SHA-256 en hexadecimal del URI canónico.
 */
export function workspaceKeyFromRootUriString(rootUriCanonical: string): string {
  return createHash('sha256').update(rootUriCanonical, 'utf8').digest('hex');
}
