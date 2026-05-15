# `system/internals/state/` — Estado en runtime

> Implementación del estado mutable del host: sesión compartida entre vistas del mini input.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `sessionStore.ts` | `GhostPromptSessionStore` + `ghostPromptSessionStore` |

Contratos de loading en `../protocols/state/loading/`. Estado de fuentes de completado (copilot, opencode, ollama) en `engines/status/`.

---

## Tests

| Archivo | Cubre |
|---|---|
| `sessionStore.test.ts` | Store, cancelación, multi-vista |
