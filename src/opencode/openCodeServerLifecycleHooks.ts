/**
 * Hooks cuando el proceso embebido OpenCode se apaga (`closeServer`).
 * Sin dependencia circular con el pool / completion.
 */

export type OpenCodeServerResetDisposer = { dispose(): void };

const listeners = new Set<() => void>();

export function onOpenCodeServerWillReset(listener: () => void): OpenCodeServerResetDisposer {
  listeners.add(listener);
  return {
    dispose: () => listeners.delete(listener),
  };
}

/** Antes de `server.close()`; limpia listeners que invalidan cachés en memoria (sesión pooled, etc.). */
export function emitOpenCodeServerWillReset(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* no-op */
    }
  }
}
