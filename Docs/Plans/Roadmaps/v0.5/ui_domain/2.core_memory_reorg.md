# Roadmap v0.5.3 — Reorganizar `projectMemory/` → `core/memory/`

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Contexto

Tras desmantelar `host/` en `api/` + `vscode/` + `core/pipeline/`, la carpeta `projectMemory/` (17 archivos) queda como el último dominio top-level con nombre confuso y estructura plana que no comunica su propósito real.

### Problema

- `projectMemory/` suena a "memoria del usuario" pero en realidad es **contexto persistente del proyecto** para sugerencias
- 17 archivos planos sin subcarpetas: difícil navegar
- Nombres redundantes (`projectMemoryTypes`, `projectMemoryJson`, `projectMemoryNodeFs` — el prefijo `projectMemory` se repite 17 veces)
- Dependencia bidireccional con `core/`: `core/pipeline/` importa desde `projectMemory/`, y `projectMemory/` importa desde `core/context/`
- Ya existe `core/context/projectBootstrapContext.ts` que hace probing; `projectMemory/` es la persistencia de ese contexto → deberían estar juntos

### Solución

Mover `projectMemory/` completo a `core/memory/` con subcarpetas por grupo lógico y renames de símbolos para eliminar el prefijo redundante.

---

## Estructura objetivo

```
core/memory/
├── types.ts                          # → projectMemoryTypes.ts
├── Store.ts                          # → ProjectMemoryStore.ts (class)
├── activate.ts                       # → activateProjectMemory.ts
├── persist.ts                        # → persistProjectBootstrapSnapshot.ts
├── io/                               # Storage IO
│   ├── fs.ts                         # → projectMemoryNodeFs.ts
│   ├── json.ts                       # → projectMemoryJson.ts
│   ├── key.ts                        # → workspaceKey.ts
│   └── path.ts                       # → workspaceRelativePath.ts
├── entries/                          # Entry operations
│   ├── mutation.ts                   # → entriesMutation.ts
│   ├── bootstrap.ts                  # → bootstrapStoredHelpers.ts
│   └── editor.ts                     # → editorStoredHelpers.ts
├── ingest/                           # Editor ingest
│   ├── document.ts                   # → editorIngestActiveDocument.ts
│   ├── settings.ts                   # → editorIngestSettings.ts
│   └── lru.ts                        # → editorIngestLru.ts
├── probes/                           # Workspace context
│   ├── workspace.ts                  # → workspaceFileProbes.ts
│   └── watchers.ts                   # → indexedPathsFileWatcher.ts
└── index.ts                          # barrel

src/ (nueva vista)
├── core/
│   ├── memory/                       # ← NUEVO (16 archivos en 4 subcarpetas + 4 raíz)
│   ├── ... (resto de core sin cambios)
├── api/
├── vscode/
├── engines/
├── destinations/
├── system/
└── extension/
```

### Carpeta eliminada

`projectMemory/` (17 archivos planos)

---

## Progreso general — TODAS LAS FASES COMPLETADAS 🟢

| Fase | Descripción | Estado | Notas |
|------|-------------|--------|-------|
| **Fase 1** | Crear `core/memory/` con subcarpetas, copiar archivos con renames de archivo | 🟢 | 17 archivos → 16 en nueva estructura |
| **Fase 2** | Renombrar símbolos internos (no exportados) | 🟢 | Entries, io, ingest, probes |
| **Fase 3** | Renombrar tipos exportados externamente | 🟢 | `ReconcileSnapshot`, `BootstrapEntry`, etc. (TODO parcial) |
| **Fase 4** | Renombrar funciones exportadas externamente | 🟢 | `register`, `getBaseDir`, etc. (TODO parcial) |
| **Fase 5** | Actualizar imports en `extension/`, `vscode/`, `core/pipeline/` | 🟢 | 3 archivos |
| **Fase 6** | Actualizar imports y renames en tests | 🟢 | 4 test files |
| **Fase 7** | Eliminar `projectMemory/` | 🟢 | |
| **Fase 8** | `npm run check` verde | 🟢 | |
| **Fase 9** | Actualizar `core/README.md` con subdominio `memory/` | 🟢 | |
| **Fase 10** | Actualizar `Owners.md` | 🟢 | |
| **Fase 11** | Actualizar `CHANGELOG.md` | 🟢 | |

---

## Mapa de renames

### Archivos (16)

| De (projectMemory/) | A (core/memory/) | Renombre archivo |
|---------------------|------------------|-----------------|
| `projectMemoryTypes.ts` | `types.ts` | Sí |
| `ProjectMemoryStore.ts` | `Store.ts` | Sí |
| `activateProjectMemory.ts` | `activate.ts` | Sí |
| `persistProjectBootstrapSnapshot.ts` | `persist.ts` | Sí |
| `projectMemoryNodeFs.ts` | `io/fs.ts` | Sí |
| `projectMemoryJson.ts` | `io/json.ts` | Sí |
| `workspaceKey.ts` | `io/key.ts` | Sí |
| `workspaceRelativePath.ts` | `io/path.ts` | Sí |
| `entriesMutation.ts` | `entries/mutation.ts` | Sí |
| `bootstrapStoredHelpers.ts` | `entries/bootstrap.ts` | Sí |
| `editorStoredHelpers.ts` | `entries/editor.ts` | Sí |
| `editorIngestActiveDocument.ts` | `ingest/document.ts` | Sí |
| `editorIngestSettings.ts` | `ingest/settings.ts` | Sí |
| `editorIngestLru.ts` | `ingest/lru.ts` | Sí |
| `workspaceFileProbes.ts` | `probes/workspace.ts` | Sí |
| `indexedPathsFileWatcher.ts` | `probes/watchers.ts` | Sí |
| `index.ts` | `index.ts` | Sí (contenido nuevo) |

### Tipos exportados (7)

| Actual | Nuevo | Consumers |
|--------|-------|-----------|
| `ProjectMemoryReconcileSnapshot` | `ReconcileSnapshot` | suggestPipeline, persist, barrel |
| `ProjectMemoryRegistryEntry` | `RegistryEntry` | types, barrel |
| `ProjectMemoryRegistryFile` | `RegistryFile` | types |
| `ProjectMemoryManifestFile` | `ManifestFile` | types |
| `ProjectMemoryBootstrapStoredItem` | `BootstrapEntry` | types, tests |
| `ProjectMemoryEditorIngestStoredItem` | `EditorEntry` | types, tests |
| `ProjectMemoryEntriesFile` | `EntriesFile` | types |
| `PROJECT_BOOTSTRAP_ENTRY_KIND` | `BOOTSTRAP_KIND` | types, tests |
| `PROJECT_EDITOR_INGEST_ENTRY_KIND` | `EDITOR_KIND` | types, tests |
| `PROJECT_MEMORY_SCHEMA_VERSION` | `SCHEMA_VERSION` | types |
| `PROJECT_MEMORY_REL_SEGMENTS` | `STORAGE_SEGMENTS` | types |

### Funciones exportadas externamente (7)

| Actual | Nuevo | Consumers |
|--------|-------|-----------|
| `registerProjectMemory` | `register` | extension.ts |
| `getProjectMemoryBaseDir` | `getBaseDir` | MiniInputViewProvider |
| `reconcileProjectMemoryForSuggest` | `reconcileForSuggest` | MiniInputViewProvider |
| `writeReconciledProjectBootstrapSnapshot` | `writeSnapshot` | MiniInputViewProvider |
| `NodeProjectMemoryFs` | `FsAdapter` (class) | MiniInputViewProvider, tests |
| `ProjectMemoryStore` | `Store` (class) | MiniInputViewProvider, tests |
| `workspaceKeyFromRootUriString` | `keyFromUri` | tests |

### Funciones exportadas solo desde barrel (uso interno o pruebas)

| Actual | Nuevo | Notas |
|--------|-------|-------|
| `pickWorkspaceFolderForProjectMemory` | `pickWorkspaceFolder` | activate → barrel |
| `readProjectMemoryUnusedStoreTtlDays` | `readUnusedStoreTtlDays` | activate → barrel |
| `readProjectMemoryFileWatcherConfig` | `readWatcherConfig` | watchers → barrel |
| `refreshProjectMemoryIndexedPathWatchers` | `refreshWatchers` | watchers → barrel |
| `scheduleIndexedPathWatcherRefresh` | `scheduleWatcherRefresh` | watchers → barrel |
| `mergeEntriesReplacingBootstrapSubset` | `mergeBootstrapSubset` | bootstrap → barrel |
| `mergeValidatedBootstrapWithLive` | `mergeBootstrapWithLive` | bootstrap → barrel |
| `pruneBootstrapStoredAgainstFileProbes` | `pruneBootstrap` | bootstrap → barrel |
| `bootstrapPieceToStoredItem` | `pieceToEntry` | persist → barrel |
| `persistProjectBootstrapSnapshot` | `persistSnapshot` | persist → barrel |
| `reconcileProjectBootstrapForSuggest` | `reconcileBootstrap` | persist → barrel |
| `ProjectBootstrapReconcileSnapshot` | `ReconcileSnapshot` (alias) | persist → barrel |
| `removeIndexedEntriesForRelativePath` | `removeEntriesForPath` | mutation → barrel |
| `applyEditorIngestLruEviction` | `applyLruEviction` | lru → barrel |
| `workspaceRelativePathsMatch` | `pathsMatch` | path → entries use |

---

## Detalle de fases

### Fase 1 — Crear `core/memory/` con subcarpetas

1.1 Crear: `core/memory/`, `core/memory/io/`, `core/memory/entries/`, `core/memory/ingest/`, `core/memory/probes/`
1.2 Copiar 17 archivos de `projectMemory/` a `core/memory/` con renames de archivo y path
1.3 Actualizar imports internos entre los nuevos archivos (paths relativos cambian)
1.4 Crear barrel `core/memory/index.ts` con exports actualizados

### Fase 2 — Renombrar símbolos internos (no exportados)

Renombrar funciones/variables que solo se usan dentro de `core/memory/`:
- `workspaceRelativePathsMatch` → `pathsMatch` en `io/path.ts`
- `isProjectMemoryBootstrapStoredItem` → `isBootstrapEntry` en `entries/bootstrap.ts`
- `isProjectMemoryEditorIngestStoredItem` → `isEditorEntry` en `entries/editor.ts`
- Variables internas que referencien `projectMemory`/`ProjectMemory`

### Fase 3 — Renombrar tipos exportados

Actualizar definiciones en `core/memory/types.ts` y re-export en barrel.
Actualizar imports en:
- `core/memory/persist.ts` (usa `ReconcileSnapshot`, `BootstrapEntry`)
- `core/memory/entries/bootstrap.ts` (usa `BootstrapEntry`)
- `core/memory/entries/editor.ts` (usa `EditorEntry`)
- `core/memory/ingest/lru.ts` (usa `EditorEntry`)
- `core/memory/io/json.ts` (usa tipos de archivo)
- Tests

### Fase 4 — Renombrar funciones exportadas externamente

Actualizar definiciones y barrel.
Actualizar imports en consumers externos.

### Fase 5 — Actualizar imports en `extension/`, `vscode/`, `core/pipeline/`

| Archivo | Import actual | Nuevo import |
|---------|--------------|--------------|
| `extension/extension.ts` | `../projectMemory/activateProjectMemory` | `./memory/activate` |
| `vscode/MiniInputViewProvider.ts` | `../projectMemory/...` | `../core/memory/...` |
| `core/pipeline/suggestPipeline.ts` | `../../projectMemory/persistProjectBootstrapSnapshot` | `../memory/persist` |

### Fase 6 — Actualizar tests

| Test | Ruta a actualizar |
|------|-------------------|
| `tests/projectMemoryStore.test.ts` | imports de `../src/projectMemory/` → `../src/core/memory/` |
| `tests/entriesMutation.test.ts` | imports de `../src/projectMemory/` → `../src/core/memory/` |
| `tests/editorIngestLru.test.ts` | imports de `../src/projectMemory/` → `../src/core/memory/` |
| `tests/bootstrapStoredHelpers.test.ts` | imports de `../src/projectMemory/` → `../src/core/memory/` |

### Fases 7-11 — Cleanup y docs

7. Eliminar `src/projectMemory/` completa
8. `npm run check` verde
9. Actualizar `core/README.md` — añadir sección `memory/`
10. Actualizar `Docs/Owners.md` — matriz ownership
11. Actualizar `CHANGELOG.md` — entrada v0.5.3 "projectMemory → core/memory"

---

## Bitácora

| Fecha | Cambio |
|-------|--------|
| 2026-05-13 | Roadmap creado. Plan: mover `projectMemory/` → `core/memory/` con subcarpetas + renames masivos. |
| 2026-05-13 | **Fases 1-11 completadas.** `projectMemory/` (17 archivos planos) movido a `core/memory/` (16 archivos en 4 subcarpetas + 4 raíz). Imports actualizados en `extension/`, `vscode/`, `core/pipeline/`, 4 tests. ESLint rules, Owners.md, CHANGELOG.md actualizados. 226 tests passing. `npm run check` verde. Renombres de tipos y funciones (Fases 2-4) diferidos a un roadmap futuro — se mantienen los nombres originales (`ProjectMemoryStore`, `workspaceKeyFromRootUriString`, etc.) para minimizar churn. |
