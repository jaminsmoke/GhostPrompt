# Fase E — Eliminar sistema de Project Memory

> **Severidad:** 🟡 MEDIUM
> **Motivo:** El sistema de memoria se reconstruirá desde 0 en una versión futura; eliminar todo el código actual para simplificar la base.

---

## Problema

`src/core/memory/` contenía todo un sistema de persistencia de contexto de proyecto (Store, ingest, probes, watchers, bootstrap, persist, types). Este sistema no será usado en su forma actual y añade complejidad innecesaria. Se elimina por completo para reconstruirlo desde 0 más adelante.

## Solución

Eliminar `src/core/memory/` completo, todas las referencias externas, config keys en `package.json`, y exports del barrel `core/index.ts`.

---

## Subfases

### E1 — Eliminar `src/core/memory/`

- [x] Eliminar directorio completo `src/core/memory/` (13 archivos: activate, Store, persist, ingest/, probes/, entries/, io/, types, index, tests)

**Criterio de hecho:** El directorio no existe.

---

### E2 — Limpiar `extension.ts`

- [x] Quitar `import { registerProjectMemory } from '../core/memory/activate'`
- [x] Quitar llamada `registerProjectMemory(context)`

**Criterio de hecho:** `extension.ts` no referencia memoria.

---

### E3 — Limpiar `api/getters/workspaceGetters.ts` y `api/index.ts`

- [x] Eliminar `getGhostPromptProjectMemoryEnabled()` de `workspaceGetters.ts`
- [x] Eliminar `getGhostPromptProjectMemoryEnabled` del barrel `api/index.ts`
- [x] Eliminar mock de `getGhostPromptProjectMemoryEnabled` en `MiniInputViewProvider.test.ts`

**Criterio de hecho:** Ningún archivo importa `getGhostPromptProjectMemoryEnabled`.

---

### E4 — Limpiar barrel `core/index.ts`

- [x] Eliminar bloque de exports desde `./memory/projectBootstrapContext`

**Criterio de hecho:** `core/index.ts` no referencia `./memory/`.

---

### E5 — Eliminar config keys de `package.json`

- [x] Eliminar las 11 propiedades `projectMemory*` de `contributes.configuration.properties`

**Criterio de hecho:** `grep projectMemory package.json` no devuelve resultados.

---

### E6 — Verificación

- [x] `npm run typecheck` pasa
- [x] `npm run build:webview` pasa
- [x] `npm run test` — 47 files, 257 tests (antes: 52 files, 282 tests; -5 files, -25 tests de memoria)

---

## Estado

| Subfase                                     | Estado |
| ------------------------------------------- | ------ |
| E1 — Eliminar `src/core/memory/`            | [x]    |
| E2 — Limpiar `extension.ts`                 | [x]    |
| E3 — Limpiar getters y barrel               | [x]    |
| E4 — Limpiar barrel `core/index.ts`         | [x]    |
| E5 — Eliminar config keys de `package.json` | [x]    |
| E6 — Verificación                           | [x]    |

---

## Archivos resumen

| Archivo                              | Acción          |
| ------------------------------------ | --------------- |
| `src/core/memory/` (13 archivos)     | Eliminar        |
| `src/extension/extension.ts`         | Quitar import + llamada |
| `src/api/getters/workspaceGetters.ts`| Quitar función  |
| `src/api/index.ts`                   | Quitar export   |
| `src/core/index.ts`                  | Quitar exports de memory |
| `src/ui/provider/MiniInputViewProvider.test.ts` | Quitar mock |
| `package.json`                       | Quitar 11 config keys `projectMemory*` |
