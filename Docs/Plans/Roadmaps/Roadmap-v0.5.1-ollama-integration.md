# Roadmap v0.5.1 — Motor Ollama + Refactorización a `engines/`

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Decisiones de diseño confirmadas

| # | Decisión |
|---|----------|
| 1 | **Exclusión de modelos por proveedor** — setting separada por engine (`ollamaExcludedModelIds`, `opencodeExcludedModelIds`) |
| 2 | **Detección automática de Ollama** — default `http://localhost:11434`, fallback silencioso |
| 3 | **Prompt templates personalizables por motor** — encapsulados en cada engine; por ahora mismo `buildCompletionInstruction` |
| 4 | **Ollama no levanta nada** — solo cliente HTTP contra API REST ya corriendo |
| 5 | **Carpeta `engines/`** — ubicación canónica para todos los motores |
| 6 | **ID de modelo literal** — `"mistral:latest"` sin prefijo `"ollama/"` (el picker ya acota por motor) |

---

## Progreso general

| Fase | Descripción | Estado | PR | Notas |
|------|-------------|--------|----|-------|
| **Fase 1** | Estructura `engines/` + migración providers existentes | 🟢 | — | completada 2026-05-13 |
| **Fase 2** | Cliente API Ollama (`ollamaApiClient.ts`) | 🟢 | — | completada 2026-05-13 |
| **Fase 3** | Adaptador Ollama CompletionProvider (`ollamaLmEngine.ts`) | 🟢 | — | completada 2026-05-13 |
| **Fase 4** | Catálogo Ollama + routing + settings | 🟢 | — | completada 2026-05-13 |
| **Fase 5** | UI webview + chips de motor | 🟢 | — | completada 2026-05-13 |
| **Fase 6** | Tests unitarios | 🟢 | — | completada 2026-05-13 |
| **Fase 7** | Documentación + release candidate | ⚪ | — | |

---

## Fase 1 — Estructura `engines/` y migración de providers

### Subpasos trackeables

| # | Subpaso | Estado | Archivos creados/modificados |
|---|---------|--------|------------------------------|
| # | Subpaso | Estado | Archivos creados/modificados |
|---|---------|--------|------------------------------|
| 1.1 | Crear directorio `src/engines/` y subdirectorios | 🟢 | `src/engines/` (mkdir) |
| 1.2 | Migrar `copilotLmCompletion.ts` → `engines/copilot/copilotLmEngine.ts` | 🟢 | Crear archivo, cambiar imports relativos |
| 1.3 | Migrar `opencodeLmCompletion.ts` → `engines/opencode/opencodeLmEngine.ts` | 🟢 | Crear archivo, cambiar imports relativos |
| 1.4 | Crear `engines/copilot/index.ts` (reexport) | 🟢 | Crear archivo |
| 1.5 | Crear `engines/opencode/index.ts` (reexport) | 🟢 | Crear archivo |
| 1.6 | Crear `engines/engineRegistry.ts` (interfaz + registro) | 🟢 | Crear archivo |
| 1.7 | Crear `engines/index.ts` (barrel) | 🟢 | Crear archivo |
| 1.8 | Reemplazar `completion/completionProvider.ts` → reexport de engines | 🟢 | Modificar archivo |
| 1.9 | Actualizar imports: `completion/index.ts`, `tests/` | 🟢 | 3 archivos modificados |
| 1.10 | Eliminar `completion/providers/` (legacy) | 🟢 | `git rm` 2 archivos |
| 1.11 | Verificar compilación limpia (`npm run compile`) | 🟢 | ✅ Sin errores |
| 1.12 | Verificar tests existentes (`npm run test`) | 🟢 | ✅ 195 passed |

**Criterio de salida de Fase 1:** Todo compila y tests pasan. Los engines están en `src/engines/`. No hay archivos huérfanos.

---

## Fase 2 — Cliente API Ollama

### Subpasos trackeables

| # | Subpaso | Estado | Archivos |
|---|---------|--------|----------|
| # | Subpaso | Estado | Archivos creados/modificados |
|---|---------|--------|------------------------------|
| 2.1 | Crear `src/engines/ollama/ollamaTypes.ts` — tipos request/response | 🟢 | `src/engines/ollama/ollamaTypes.ts` |
| 2.2 | Crear `src/engines/ollama/ollamaApiClient.ts` — `listModels()`, `generate()` con streaming | 🟢 | `src/engines/ollama/ollamaApiClient.ts` |
| 2.3 | Añadir `getGhostPromptOllamaBaseUrl()` + `getGhostPromptOllamaExcludedModelIds()` a `ghostPromptHostWorkspaceGetters.ts` | 🟢 | `src/host/ghostPromptHostWorkspaceGetters.ts` |
| 2.4 | Crear `src/engines/ollama/index.ts` (barrel) y actualizar `engines/index.ts` | 🟢 | `src/engines/ollama/index.ts`, `src/engines/index.ts` |
| 2.5 | Verificar compilación y tests | 🟢 | ✅ 195 passed |

**Criterio de salida:** El cliente Ollama funciona con `fetch` de Node 18+. Maneja errores gracefully.

---

## Fase 3 — Adaptador Ollama CompletionProvider

### Subpasos trackeables

| # | Subpaso | Estado | Archivos |
|---|---------|--------|----------|
| 3.1 | Crear `src/engines/ollama/ollamaLmEngine.ts` — `requestCompletion()` | 🟢 | `src/engines/ollama/ollamaLmEngine.ts` |
| 3.2 | Añadir fases de loading `"ollama-start"`, `"ollama-generating"` en `suggestionLoadingUi.ts` | 🟢 | `src/completion/suggestionLoadingUi.ts` |
| 3.3 | Registrar el engine en `engines/engineRegistry.ts` | 🟢 | `src/engines/engineRegistry.ts` |
| 3.4 | Actualizar `completionSources.ts` — `looksLikeOllamaModelId()`, routing `"auto"`, `normalizeCompletionSources` | 🟢 | `src/completion/completionSources.ts`, `src/completion/index.ts` |
| 3.5 | Actualizar `ghostPromptSuggestPipeline.ts` — fase inicial + streaming para "ollama" | 🟢 | `src/host/ghostPromptSuggestPipeline.ts` |
| 3.6 | Verificar compilación y tests | 🟢 | ✅ 195 passed |

**Criterio de salida:** `getCompletionProviderForSource("ollama")` devuelve el provider Ollama. El pipeline de sugerencia funciona con Ollama.

---

## Fase 4 — Catálogo y routing

### Subpasos trackeables

| # | Subpaso | Estado | Archivos |
|---|---------|--------|----------|
| 4.1 | Crear `completion/catalog/ollamaModelCatalog.ts` | 🟢 | Nuevo |
| 4.2 | Crear `completion/catalog/normalizeOllamaModels.ts` | 🟢 | Nuevo |
| 4.3 | Actualizar `mergedModelCatalog.ts` para incluir Ollama | 🟢 | Modificado |
| 4.4 | Añadir settings `ollamaBaseUrl` y `ollamaExcludedModelIds` en `package.json` + enums | 🟢 | Modificado |
| 4.5 | Añadir `"ollama"` a enums Zod en schemas + barrel + types | 🟢 | `shared/webviewMessageSchemas.ts`, `completion/types.ts` |
| 4.6 | Actualizar `applyWebviewUpdateSetting.ts` + `ghostPromptSettingsPostMessage.ts` | 🟢 | Modificado |
| 4.7 | Verificar compilación y tests | 🟢 | ✅ 195 passed |

**Criterio de salida:** Seleccionar `"mistral:latest"` en el dropdown enruta al engine Ollama. El modelo aparece con label `"mistral:latest"`, tier `"included"`.

---

## Fase 5 — UI webview y settings

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 5.1 | Añadir `<option value="ollama">` en el selector HTML del webview | 🟢 |
| 5.2 | Actualizar change handler en `main.ts` para aceptar `"ollama"` | 🟢 |
| 5.3 | Actualizar settings handler `motorSelectValue` para `"ollama"` | 🟢 |
| 5.4 | Actualizar grouping y sorting de providers en `setModelOptions` | 🟢 |
| 5.5 | Verificar bundle webview, compilación y tests | 🟢 |

**Criterio de salida:** El usuario ve el chip "Ollama" en el selector de motor. Los modelos Ollama aparecen en el dropdown. La URL base es configurable.

---

## Fase 6 — Tests

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 6.1 | Tests unitarios `ollamaApiClient` (mock fetch) | 🟢 |
| 6.2 | Tests unitarios `ollamaLmEngine` (mock client) | 🟢 |
| 6.3 | Tests `resolveCompletionSourceForRequest` con `"ollama"` | 🟢 |
| 6.4 | Tests `mergedModelCatalog` con modelos Ollama | 🟢 |
| 6.5 | Tests `completionSources` — `getEnabledCompletionSources` con Ollama | 🟢 |
| 6.6 | Tests `engineRegistry` — routing a engines | 🟢 |

**Criterio de salida:** `npm run test` pasa sin fallos.

---

## Fase 7 — Documentación y release

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 7.1 | Actualizar `Docs/ARCHITECTURE.md` — sección engines/ | ⚪ |
| 7.2 | Actualizar `GhostPrompt-motor-destino-matrix.md` — Situaciones 5 y 6 | ⚪ |
| 7.3 | Crear `Docs/Plans/Roadmaps/Roadmap-v0.5.1-ollama.md` | ⚪ |
| 7.4 | Actualizar `Owners.md` | ⚪ |
| 7.5 | CHANGELOG.md — entrada v0.5.1 | ⚪ |
| 7.6 | `npm run validate` pasa completo | ⚪ |

---

## Preguntas abiertas resueltas o pendientes

| # | Pregunta | Respuesta |
|---|----------|-----------|
| Q1 | ¿Nombre de carpeta? | `engines/` ✅ |
| Q2 | ¿Stubs o borrado directo? | Borrado directo ✅ |
| Q3 | ¿ID de modelo Ollama con prefijo o literal? | Literal (`"mistral:latest"`) ✅ |
| Q4 | ¿Enfoque de PRs? | Incremental por fase/fase ✅ |
| Q5 | Ollama modelos list — ¿solo los del `ollama list` actual? | Sí, el API `/api/tags` devuelve los locales ✅ |
| **Pendiente** | ¿Hay que migrar modelos OpenCode a `engines/opencode/` como archivos separados (`apiClient`) o se quedan dentro de `src/opencode/`? | Se queda como está; `src/opencode/` tiene runtime/SDK/CLI que es infraestructura compartida. Solo el *adapter* de completion se mueve a `engines/opencode/`. |
| **Pendiente** | ¿`@opencode-ai/sdk` dependency se mueve o se queda en `package.json`? | Se queda; es dependencia del engine OpenCode. |

---

## Estructura final esperada (post-fase 1)

```
src/
├── engines/
│   ├── index.ts
│   ├── engineRegistry.ts
│   ├── copilot/
│   │   ├── copilotLmEngine.ts   ← movido de completion/providers/
│   │   └── index.ts
│   ├── opencode/
│   │   ├── opencodeLmEngine.ts  ← movido de completion/providers/
│   │   └── index.ts
│   └── ollama/                  ← NUEVO
│       ├── ollamaLmEngine.ts
│       ├── ollamaApiClient.ts
│       ├── ollamaTypes.ts
│       └── index.ts
├── completion/
│   ├── types.ts                 ← sin cambios
│   ├── completionSources.ts     ← actualizado (+ollama)
│   ├── instruction.ts
│   ├── normalize.ts
│   ├── streaming.ts
│   ├── language.ts
│   ├── suggestionLoadingUi.ts   ← +fases ollama
│   ├── catalog/
│   │   ├── modelCatalog.ts
│   │   ├── opencodeModelCatalog.ts
│   │   ├── ollamaModelCatalog.ts    ← NUEVO
│   │   ├── normalizeOpencodeModels.ts
│   │   ├── normalizeOllamaModels.ts ← NUEVO
│   │   └── mergedModelCatalog.ts    ← actualizado
│   ├── context/
│   └── index.ts
├── opencode/                    ← sin cambios (runtime/SDK/CLI)
├── host/                        ← actualizar imports
├── shared/                      ← actualizar schemas
└── ...
```