# Roadmap v0.5.2 — Limpieza estructural post-refactor

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Estado: **Fases 1-3 completadas**. Fases 4-10 pendientes.

---

---

## Contexto

Tras la reestructuración de OpenCode (commits `ab4cc14`, `9a16b95`), quedaron inconsistencias en la estructura de carpetas:

1. `src/completion/catalog/` contenía archivos **específicos de motores** (Copilot, Ollama) que deberían vivir en `src/engines/<motor>/catalog/`
2. `src/completion/completionProvider.ts` es un re-export redundante de `engines/engineRegistry.ts`
3. `src/completion/catalog/` quedó vacío tras mover los 3 archivos engine-specific
4. `src/destinations/` no tiene barrel `index.ts` (todos los engines sí tienen uno)
5. `src/engines/index.ts` está incompleto — no re-exporta `copilot/` ni `opencode/`
6. `.eslintrc.json` tiene regla huérfana apuntando a `src/opencode/` (eliminado)
7. Tests con mocks de paths eliminados (`tests/mergedModelCatalog.test.ts`, `tests/completionProvider.test.ts`)

---

## Progreso general

| Fase | Descripción | Estado | Commit | Notas |
|------|-------------|--------|--------|-------|
| **Fase 1** | Mover `modelCatalog.ts` → `engines/copilot/catalog/` | 🟢 | TBD | Barrel copilot actualizado, imports locales |
| **Fase 2** | Mover `normalizeOllamaModels.ts` + `ollamaModelCatalog.ts` → `engines/ollama/catalog/` | 🟢 | TBD | Barrel ollama actualizado, imports locales |
| **Fase 3** | Aplanar `catalog/mergedModelCatalog.ts` → `completion/mergedModelCatalog.ts` | 🟢 | TBD | Carpeta `completion/catalog/` eliminada |
| **Fase 4** | Eliminar `completion/completionProvider.ts` (redundante) | ⚪ | — | |
| **Fase 5** | Crear `destinations/index.ts` barrel | ⚪ | — | |
| **Fase 6** | Completar `engines/index.ts` barrel | ⚪ | — | |
| **Fase 7** | Actualizar barrel `completion/index.ts` | ⚪ | — | |
| **Fase 8** | Tests: actualizar mocks e imports rotos | ⚪ | — | |
| **Fase 9** | Config: eliminar regla ESLint huérfana `src/opencode/` | ⚪ | — | |
| **Fase 10** | Docs: actualizar README + bitácora | ⚪ | — | |

---

## Fase 1 — Mover `modelCatalog.ts` a `engines/copilot/catalog/`

### Archivos

```
src/completion/catalog/modelCatalog.ts  →  src/engines/copilot/catalog/modelCatalog.ts
```

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 1.1 | Crear `src/engines/copilot/catalog/` | ⚪ |
| 1.2 | Mover `modelCatalog.ts` | ⚪ |
| 1.3 | Actualizar import en `engines/copilot/copilotLmEngine.ts` → `./catalog/modelCatalog` | ⚪ |
| 1.4 | Actualizar import en `completion/catalog/mergedModelCatalog.ts` → `../../engines/copilot/catalog/modelCatalog` | ⚪ |
| 1.5 | Actualizar re-export en `completion/index.ts` → `../engines/copilot/catalog/modelCatalog` | ⚪ |
| 1.6 | Actualizar `engines/copilot/index.ts` — agregar re-export del catalog | ⚪ |
| 1.7 | Eliminar original de `completion/catalog/` | ⚪ |

**Criterio de salida:** `npm run check` verde, imports locales en copilot engine.

---

## Fase 2 — Mover archivos Ollama a `engines/ollama/catalog/`

### Archivos

```
src/completion/catalog/normalizeOllamaModels.ts  →  src/engines/ollama/catalog/normalizeOllamaModels.ts
src/completion/catalog/ollamaModelCatalog.ts     →  src/engines/ollama/catalog/ollamaModelCatalog.ts
```

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 2.1 | Crear `src/engines/ollama/catalog/` | ⚪ |
| 2.2 | Mover `normalizeOllamaModels.ts` | ⚪ |
| 2.3 | Mover `ollamaModelCatalog.ts` | ⚪ |
| 2.4 | Actualizar import en `ollamaModelCatalog.ts` → `./normalizeOllamaModels` (local) | ⚪ |
| 2.5 | Actualizar import en `completion/catalog/mergedModelCatalog.ts` → `../../engines/ollama/catalog/ollamaModelCatalog` | ⚪ |
| 2.6 | Actualizar re-export en `completion/index.ts` → `../engines/ollama/catalog/ollamaModelCatalog` | ⚪ |
| 2.7 | Actualizar `engines/ollama/index.ts` — agregar re-exports del catalog | ⚪ |
| 2.8 | Eliminar originales de `completion/catalog/` | ⚪ |

**Criterio de salida:** `npm run check` verde, imports locales en ollama engine.

---

## Fase 3 — Aplanar `mergedModelCatalog.ts`

### Archivos

```
src/completion/catalog/mergedModelCatalog.ts  →  src/completion/mergedModelCatalog.ts
```

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 3.1 | Mover archivo a `completion/` raíz | ⚪ |
| 3.2 | Actualizar imports internos (apuntan a `./modelCatalog`, `./ollamaModelCatalog`, `./opencodeModelCatalog`) | ⚪ |
| 3.3 | Actualizar re-export en `completion/index.ts` → `./mergedModelCatalog` | ⚪ |
| 3.4 | Eliminar carpeta `completion/catalog/` (vacía) | ⚪ |

**Criterio de salida:** `npm run check` verde, `src/completion/catalog/` eliminada.

---

## Fase 4 — Eliminar `completionProvider.ts`

### Archivos

```
src/completion/completionProvider.ts  →  ELIMINAR
```

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 4.1 | Actualizar `completion/index.ts` — importar directo de `../engines/engineRegistry` | ⚪ |
| 4.2 | Actualizar `tests/completionProvider.test.ts` — importar de `../src/engines/engineRegistry` | ⚪ |
| 4.3 | Buscar y actualizar cualquier otro import de `completionProvider` | ⚪ |
| 4.4 | Eliminar archivo | ⚪ |

**Criterio de salida:** `npm run check` verde, 0 refs a `completionProvider.ts`.

---

## Fase 5 — Crear `destinations/index.ts`

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 5.1 | Crear barrel público con re-exports de `destinationRegistry`, `copilotChatDestination`, `vsOpenCodeXDestination` | ⚪ |
| 5.2 | Verificar que no haya imports rotos | ⚪ |

**Criterio de salida:** `npm run check` verde, barrel consistente con patrón de `engines/`.

---

## Fase 6 — Completar `engines/index.ts`

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 6.1 | Agregar re-export de `copilot/index` | ⚪ |
| 6.2 | Agregar re-export de `opencode/index` | ⚪ |
| 6.3 | Verificar que `ollama/index` ya esté incluido | ⚪ |

**Criterio de salida:** `engines/index.ts` re-exporta los 3 engines completos.

---

## Fase 7 — Actualizar `completion/index.ts`

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 7.1 | Eliminar re-export de `completionProvider` (ya en Fase 4) | ⚪ |
| 7.2 | Actualizar path de `mergedModelCatalog` → `./mergedModelCatalog` (Fase 3) | ⚪ |
| 7.3 | Actualizar path de `modelCatalog` → `../engines/copilot/catalog/modelCatalog` (Fase 1) | ⚪ |
| 7.4 | Actualizar path de `ollamaModelCatalog` → `../engines/ollama/catalog/ollamaModelCatalog` (Fase 2) | ⚪ |
| 7.5 | Mantener re-export de `opencodeModelCatalog` → `../engines/opencode/catalog/opencodeModelCatalog` (ya correcto) | ⚪ |

**Criterio de salida:** Barrel limpio, sin refs a `catalog/` folder eliminado.

---

## Fase 8 — Tests: actualizar mocks e imports rotos

### Archivos a tocar

| Test | Cambio |
|------|--------|
| `tests/mergedModelCatalog.test.ts` | Mock path: `../src/engines/opencode/catalog/opencodeModelCatalog` |
| `tests/completionProvider.test.ts` | Import: `../src/engines/engineRegistry` |
| `tests/ollamaLmEngine.test.ts` | Verificar imports de catalog si aplica |
| `tests/mergedModelCatalog.test.ts` | Verificar imports de catalog |

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 8.1 | Actualizar mocks en `mergedModelCatalog.test.ts` | ⚪ |
| 8.2 | Actualizar imports en `completionProvider.test.ts` | ⚪ |
| 8.3 | Ejecutar `npm run test` — todos verdes | ⚪ |

**Criterio de salida:** 226+ tests passing, 0 failures.

---

## Fase 9 — Config: eliminar regla ESLint huérfana

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 9.1 | Eliminar regla `target: ./src/opencode/**/*` de `.eslintrc.json` | ⚪ |
| 9.2 | Ejecutar `npm run lint` — sin errores | ⚪ |

**Criterio de salida:** ESLint limpio, 0 refs a `src/opencode/`.

---

## Fase 10 — Docs: actualizar README + bitácora

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| 10.1 | Actualizar `README.md` — eliminar refs a `src/opencode/` | ⚪ |
| 10.2 | Actualizar `Docs/ARCHITECTURE.md` — estructura final de carpetas | ⚪ |
| 10.3 | Actualizar `Docs/Owners.md` — matriz y mapa de tests | ⚪ |
| 10.4 | Actualizar `CHANGELOG.md` — entrada para limpieza estructural | ⚪ |
| 10.5 | Marcar todas las fases de este roadmap como 🟢 | ⚪ |

**Criterio de salida:** Documentación coherente con estructura real del código.

---

## Estructura final de `src/`

```
src/
  build/
    verifyWebviewBundle.ts

  completion/                          # Core cross-engine
    context/
      projectBootstrapContext.ts
    mergedModelCatalog.ts              # ← aplanado (era catalog/)
    completionSources.ts
    index.ts
    instruction.ts
    language.ts
    normalize.ts
    streaming.ts
    suggestionLoadingUi.ts
    types.ts

  debug/
    SuggestionDebug.ts

  destinations/
    copilotChat/
      copilotChatDestination.ts
    vsOpenCodeX/
      vsOpenCodeXDestination.ts
    destinationRegistry.ts
    index.ts                           # ← nuevo

  engines/
    copilot/
      catalog/                         # ← nuevo
        modelCatalog.ts                # ← movido
      copilotLmEngine.ts
      index.ts

    ollama/
      catalog/                         # ← nuevo
        normalizeOllamaModels.ts       # ← movido
        ollamaModelCatalog.ts          # ← movido
      index.ts
      ollamaApiClient.ts
      ollamaLmEngine.ts
      ollamaTypes.ts

    opencode/
      catalog/
        normalizeOpencodeProviderModels.ts
        opencodeModelCatalog.ts
        opencodeModelTier.ts
      index.ts
      opencodeApiClient.ts
      opencodeLmEngine.ts

    engineRegistry.ts
    index.ts                           # ← completado

  extension/
    extension.ts

  governor/
    SuggestionRequestGovernor.ts

  host/                                # (todos los archivos existentes)

  log/
    ConversationLog.ts
    SuggestionLog.ts

  projectMemory/                       # (todos los archivos existentes)

  session/
    GhostPromptSessionStore.ts

  shared/
    webviewMessageSchemas.ts
```

---

## Bitácora

| Fecha | Cambio |
|-------|--------|
| 2026-05-13 | Roadmap creado post-refactor OpenCode (commits `ab4cc14`, `9a16b95`) |
