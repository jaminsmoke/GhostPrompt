# Roadmap v0.4 — Memoria de proyecto por workspace (JSON) y contexto enriquecido

> **Versión objetivo:** **GhostPrompt 0.4.0** (contexto de repo acotado y persistente por carpeta de workspace, sin mezclar memorias entre repos; refinamiento del modo `project` existente).
>
> **Antecedentes:** modo `contextMode: project` hoy aporta solo señales del editor activo vía `collectGhostPromptProjectContext` → `instruction.ts` (workspace name, archivo activo, idioma, selección). Este roadmap define **store local por raíz de workspace**, **bootstrap** (README / manifiestos), **ingesta al abrir archivos relevantes**, **invalidación** frente a cambios/borrados y **recolección de basura** por tiempo sin uso. Decisión de persistencia: **JSON** en v0.4; migración a SQLite u otro motor **solo si** el volumen o las consultas lo exigen una versión posterior.

---

## Objetivo

1. **Conocimiento acotado del repositorio**: además del contexto volátil del documento activo, incorporar extractos o resúmenes de archivos “ancla” y, con el uso, de otros archivos relevantes abiertos en el editor.
2. **Aislamiento por carpeta de workspace**: un **store independiente por `WorkspaceFolder`** (raíz); **no fusionar** datos de varias raíces en un solo JSON lógico.
3. **Persistencia local**: JSON (y/o ficheros JSON particionados bajo un directorio por repo) en **almacenamiento de extensión**, no en el repo del usuario salvo decisión explícita futura.
4. **Coherencia ante cambios**: evitar memoria obsoleta mediante **validación al leer** (existencia del fichero, hash o mtime) y, opcionalmente, **watcher** del FS; **no** bastar solo con TTL por repo para filas sueltas obsoletas.
5. **Límites y privacidad**: cuotas por workspace, denylist (p. ej. secretos, artefactos grandes), documentación clara de qué se indexa y dónde se guarda.

---

## Decisiones cerradas (design record)

| Tema | Decisión |
|------|-----------|
| Persistencia v0.4 | **JSON**; revisar migración si en la práctica fallan cuotas o consultas. |
| Unidad de aislamiento | **Un store por `WorkspaceFolder`** (path/URI estable derivado en código); multi-root: **elegir store según la raíz del archivo activo** (o la carpeta asociada al evento de ingestión). |
| Contexto combinado | Mantener **contexto de documento activo** (existente) **más** texto servido desde el **store** del repo cuando `contextMode === "project"`. |
| Ingesta al abrir | Al **enfocar** un documento del workspace, si cumple criterios de relevancia/tamaño/extensiones y falta en el store o está **stale**, **añadir o refrescar** entrada. |
| Huérfanos / drift | En **cada uso** de una entrada del índice: si el fichero no existe → **eliminar** entrada; si hash o mtime ≠ almacenados → **releer y actualizar** o marcar pendiente de refresh. |
| Crecimiento JSON | **Cuotas** (`maxTotalBytes` / `maxEntries` por repo, techo por fichero) + **evicción LRU** dentro del mismo workspace si se supera el techo. Objetivo **asintótico** “mucho del repo”, **no** índice sin límite. |
| GC repos completos | **`registry.json`** global con `workspaceKey`, ruta del store, **`lastSeenAt`**. Al **activate**: si `now - lastSeenAt > ghostPrompt.projectMemoryUnusedStoreTtlDays` (**30** días por defecto), **borrar** carpeta de ese store y entrada en registry. |
| Comandos | **“Clear GhostPrompt memory for this workspace”** (solo el store de la raíz actual o la elegida); opcional **clear all** destructivo con confirmación. |

---

## Baseline en código (antes de v0.4)

- `src/host/ghostPromptHostWorkspaceGetters.ts` — `collectGhostPromptProjectContext()` y `getGhostPromptContextMode()`.
- `src/completion/instruction.ts` — ensambla bloque “Relevant project context” a partir del objeto `project` cuando aplica.
- `src/host/handleGhostPromptSuggest.ts` — sólo pasa `collectProjectContext()` si `contextMode === "project"`.
- **`src/projectMemory/`** (v0.4 B+) — `globalStorageUri/ghostPrompt/projectMemory/v1/registry.json` + `stores/<sha256>/` (`manifest.json`, `entries.json`), GC y comando clear.
- **Fase C** — `persistProjectBootstrapSnapshot.ts`: `reconcileProjectMemoryForSuggest` (valida mtime/hash + merge con vivas antes del gobernador) + `writeReconciledProjectBootstrapSnapshot` (tras decisión LM); `ghostPrompt.projectMemoryEnabled`.
- **Fase D** — `editor-ingest` en `entries.json`, listener debounced en `activateProjectMemory.ts`, cuotas/LRU (`editorIngestLru.ts`), settings `projectMemoryEditor*` / `projectMemoryMax*`.
- **Fase E** — `indexedPathsFileWatcher.ts`: un `FileSystemWatcher` por ruta indexada, invalidación throttled, `projectMemoryFileWatcherEnabled` / `projectMemoryFileWatcherThrottleMs`.

El pipeline de v0.4 debe **inyectar** contenido adicional del store **en el mismo punto lógico** (o capa adyacente) sin romper el flujo Copilot/OpenCode ni el gobernador.

---

## Modelo de almacenamiento (orientativo)

Implementación fase B: **`ExtensionContext.globalStorageUri/ghostPrompt/projectMemory/v1/`** (subcarpeta versionada).

Propuesta de layout (v1):

```text
ghostPrompt/projectMemory/v1/
  registry.json                 # [{ workspaceKey, storeRelativePath, lastSeenAt }]
  stores/
    <workspaceKeySha>/
      manifest.json             # versión schema, quotas, estadísticas opcionales
      entries.json              # array de entradas, o chunks particionados
```

Cada **entrada** (ejemplo conceptual, no schema definitivo):

- `relativePath`: relativo **a esa** raíz de workspace (normalizado).
- `kind`: `"bootstrap"` | `"editor-ingest"` (u otros).
- `contentSnippet` o `contentHash` + relectura opcional desde disco al ensamblar prompt.
- `mtimeMs` y/o `contentHash` para invalidación rápida.
- `lastUsedAt`, `indexedAt` para LRU.

**Privacidad:** por defecto excluir paths que coincidan con patrones conocidos (`**/node_modules/**`, `**/.env*`, opcionalmente respetar `.gitignore`). Documentar en README.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| JSON enorme | Cuotas globales por repo + partición + LRU; techo explícito de tokens enviados al LM por request. |
| Memoria contradictoria tras borrar/editar archivo | Validación obligatoria al leer; watcher opcional (fase tardía); TTL 30d **no sustituye** invalidación por fichero. |
| Indexar secretos | Denylist, límites de tamaño, extensiones permitidas; no indexar fuera del workspace sin opt-in futuro. |
| Multi-root confusión | Un store por folder; selección determinista por `WorkspaceFolder` del `Uri` del documento activo. |
| Coste Latencia primera sugerencia | Bootstrap y refresh en segundo plano; bloque síncrono mínimo en el critical path del `suggest`. |

---

## Política de tests

1. Tras cada fase sustantiva: **`npm run check`** verde (incluye `deps:circular`, webview bundle, ESLint host).
2. **Lógica pura** (`workspaceKey`, normalización paths, fusión LRU, filtros denylist): **Vitest unitario** con fixtures en memoria (`vscode.workspace.fs` mockeado cuando haga falta).
3. Tests de integración con árbol de archivos temporal **opcional** en fases avanzadas; si el coste es alto, spike documentado en bitácora.
4. No relajar coberturas en `instruction` / gobernador al inyectar el nuevo texto: tests de regressión sobre longitud truncada / ausencia de store.

---

## Alcance explícito no prioritario en v0.4

| Tema | Decisión |
|------|-----------|
| **SQLite / nivel DB** | Fuera del MVP; sólo después de necesidad demostrada. |
| **Embeddings / semántica** | Fuera de v0.4; reconsiderar tras cuotas + ingest texto. |
| **Indexación completa repo en segundo plano (sin límites)** | No; sólo ingestión dirigida bootstrap + ficheros cumpliendo filtros / eventos editor. |

---

## Fases y criterios de aceptación

### Fase A — “Project card” ampliado en memoria (sin persistencia en disco)

**Meta:** Ampliar el bloque de contexto cuando `contextMode === "project"` leyendo en activación lazy (o primera sugerencia) fragmentos breves de `README*` / `README.md`, `package.json` (solo metadatos + scripts resumidos), sin store JSON aún.

| ID | Entregable | Criterio |
|----|------------|----------|
| A1 | Ensamblado texto “project card” | Techo documentado en LOC/tokens por bloque (p. ej. truncado igual que hoy selección). |
| A2 | Integración pipeline | Pasar el bloque desde host/completion hasta `instruction` sin duplicar lógica de Copilot/OpenCode paths. |
| A3 | Tests | Unit sobre construcción de card con fixtures de archivo (filesystem mock o texto inyectado). |

**Estado:** **Implementado** (README/package en memoria vía `projectBootstrapContext.ts`, pipeline `handleGhostPromptSuggest` → `SuggestionContext` → `instruction`; huella `projectBootstrapFingerprint` en gobernador para coherencia de caché).

---

### Fase B — Estructura de store + registry + GC por tiempo + comandos clear

**Meta:** Crear directorio por `workspaceKey`, `registry.json`, actualizar `lastSeenAt`, limpieza al `activate`, comando “limpiar memoria este workspace”.

| ID | Entregable | Criterio |
|----|------------|----------|
| B1 | API interna tipo `ProjectMemoryStore` | Crear/leer/write manifest + entries placeholder. |
| B2 | Registry + GC | Eliminar árboles sin uso más de `ghostPrompt.projectMemoryUnusedStoreTtlDays` (default **30**). |
| B3 | Comandos contrib | Al menos comando “Clear GhostPrompt memory for this workspace”. |
| B4 | Tests | Persistencia manifest/registry con fs virtual o mocks. |

**Estado:** **Implementado** (`ProjectMemoryStore`, `registerProjectMemory` en activate, comando `ghostPrompt.clearProjectMemoryThisWorkspace`, GC tras tocar raíces abiertas, tests `projectMemoryStore.test.ts`).

---

### Fase C — Persistir bootstrap en store + invalidación por lectura + integración con suggest

**Meta:** Persistir contenido estable de bootstrap en JSON bajo Phase B paths; antes de usar cada entrada validar archivo; purgar huérfanos/stale.

| ID | Entregable | Criterio |
|----|------------|----------|
| C1 | Write bootstrap después de card válido | Mismo contenido truncado que fase A, con hash/mtime. |
| C2 | Read path merge | Concatenación ordenada estable al prompt cuando `project`. |
| C3 | Validación borrado/edición disco | Tests que simulan mtime cambiado → refresh; archivo borrado → entrada eliminada. |

**Estado:** **Implementado** (`ProjectBootstrapPiece` + reconcile/write en suggest; orden README* → otros → `package.json`; tests `bootstrapStoredHelpers.test.ts`).

---

### Fase D — Ingesta por documento abierto + cuotas + LRU

**Meta:** `onDidChangeActiveTextEditor` (o listener equivalente): si documento dentro del workspace, pasa filtros y falta/stale entrada, indexar excerpt con cuotas globales LRU.

| ID | Entregable | Criterio |
|----|------------|----------|
| D1 | Criterios de relevancia | Extensiones/size máximo documentados (`contributes.configuration`). |
| D2 | Cuotas | `projectMemoryMaxBytes`/`maxSources` valores por defecto razonables. |
| D3 | Tests | LRU y dedupe por `relativePath`. |

**Estado:** **Implementado** (`editorIngestActiveDocument.ts`, `reconcileProjectMemoryForSuggest` añade líneas tras bootstrap; `tests/editorIngestLru.test.ts`; settings en `package.json`).

---

### Fase E (opcional v0.4 vs v0.4.x) — File system watcher

**Meta:** Invalidación proactiva throttled cuando cambien paths presentes en el índice.

| ID | Criterio |
|----|----------|
| E1 | Watcher limitado a paths indexados o glob acotado; sin escanear repo entero. |
| E2 | Documentar coste batería y opt-out en settings. |

**Estado:** **Implementado** (watchers sólo sobre rutas en `entries.json`; opt-out `ghostPrompt.projectMemoryFileWatcherEnabled`; throttle configurable).

---

### Fase F — Documentación y release checklist

**Meta:** Actualizar README y `Docs/ARCHITECTURE.md`; settings en `package.json` con markdownDescription; entrada CHANGELOG para 0.4.0.

| ID | Criterio |
|----|----------|
| F1 | Sección política privacidad + ubicación ficheros disk. |
| F2 | QA manual: multi-root dos carpetas índices aislados; clear command; sug. con project on/off. |

**Estado:** **Implementado** (README: privacidad + almacenamiento + tabla settings `projectMemory*` + QA manual F2; `Docs/ARCHITECTURE.md` §5 project memory; `CHANGELOG.md` **[0.4.0]**; `package.json` **0.4.0**).

---

## Settings nuevos (propuesta inicial)

Todos bajo prefijo `ghostPrompt.` (nombres finales al implementar):

| Clave | Tipo | Default (propuesto) | Descripción corta |
|-------|------|---------------------|---------------------|
| `projectMemoryEnabled` | boolean | **true** (`package.json`; desactivable) | Persistencia + fusión reconcile → prompt cuando `project`. |
| `projectMemoryMaxTotalBytes` | number | **393216** (`package.json`) | Cap serializado pool editor-ingest antes de LRU. |
| `projectMemoryMaxEntryBytes` | number | **32768** | Bytes leídos del fichero al indexar excerpt. |
| `projectMemoryEditorIngestEnabled` / `projectMemoryMaxEditorSources` / `projectMemoryEditorMaxFileBytes` / `projectMemoryEditorAllowedExtensions` / `projectMemoryEditorPathExcludeGlobs` | ver `package.json` | Fase D |
| `projectMemoryUnusedStoreTtlDays` | number | **30** | GC de carpetas de repos no tocados. |
| `projectMemoryFileWatcherEnabled` / `projectMemoryFileWatcherThrottleMs` | ver `package.json` | Fase E |
| `projectMemoryRespectGitignore` | boolean | `true` (si implementación lo permite sin coste excesivo) | Evitar rutas ignoradas como candidatas. |

Ajustar defaults tras medición en proyectos reales.

---

## Orden recomendado

1. **A** — validación de UX y tokens sin riesgo de disco.
2. **B + C** — fundamento persistente antes de automatizar ingestión masiva desde editor.
3. **D** — ampliación progresiva con cuotas (donde aparece mayor riesgo de contexto equivocado si falla invalidación → **ya** tener C estable).
4. **E** — solo si tras D queda ventana grande de inconsistencia.
5. **F** — cierre público release.

---

## Checklist global de versión 0.4.0

- [x] Política de tests respetada (`npm run check` donde aplique por fase).
- [x] Fase A — Project card ampliado (sin disco).
- [x] Fase B — Store por workspace + registry + GC + comandos clear.
- [x] Fase C — Bootstrap persistente + validación huérfanos/stale en lectura + integración suggest.
- [x] Fase D — Ingest por editor activo + cuotas + LRU.
- [x] Fase E — Watcher (opcional, bitácora si se aplaza).
- [x] Fase F — README / ARCHITECTURE / settings / QA manual / CHANGELOG.
- [x] `package.json` y `CHANGELOG.md` → **0.4.0** al publicar.

---

## Bitácora

| Fecha | Nota |
|-------|------|
| 2026-05-10 | Roadmap creado tras acuerdo de decisión JSON, store por repo, ingest editor, LRU/cuotas, validación lectura + GC repos 30 d. |
| 2026-05-10 | Fase A cerrada: bootstrap README/package.json en memoria (`src/completion/context/projectBootstrapContext.ts`; antes raíz `completion`), `projectBootstrapLines` + huella en caché del gobernador, tests Vitest. |
| 2026-05-10 | Fase B cerrada: `src/projectMemory/` (store/registry/GC/comando clear), layout bajo globalStorage `ghostPrompt/projectMemory/v1`. |
| 2026-05-10 | Fase C cerrada: entradas `bootstrap` en `entries.json` (mtime+sha256), reconcile antes del gobernador y flush en ruta LM; setting `ghostPrompt.projectMemoryEnabled`. |
| 2026-05-10 | Fase D cerrada: `editor-ingest`, listener activo con debounce, LRU/recuento; líneas editor tras bootstrap en prompt si `projectMemoryEditorIngestEnabled`. |
| 2026-05-10 | Fase E cerrada: watchers por ruta indexada + invalidación en disco (`indexedPathsFileWatcher.ts`), `workspaceRelativePath.ts` para tests sin vscode. |
| 2026-05-10 | Fase F cerrada: README (privacidad, settings project memory, QA manual), `ARCHITECTURE.md` almacenamiento v0.4, `CHANGELOG` **[0.4.0]**, versión **0.4.0**. |

---

## Referencias cruzadas

- **OpenCode — rendimiento catálogo, sesiones y telemetría debug (v0.4 aditivo):** [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Roadmap-v0.4-opencode-perf-catalog-telemetry.md).
- Arquitectura general: [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md).
- Pipeline de instrucciones y contexto actual: [`src/completion/instruction.ts`](../../../src/completion/instruction.ts), [`src/host/ghostPromptHostWorkspaceGetters.ts`](../../../src/host/ghostPromptHostWorkspaceGetters.ts).
- Host refactor y contratos precedentes: [`Roadmap-v0.3.2-host-refactor-webview-tooling.md`](./Roadmap-v0.3.2-host-refactor-webview-tooling.md).
