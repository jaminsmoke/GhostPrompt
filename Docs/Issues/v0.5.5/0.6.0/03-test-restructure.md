# Fase C — Co-locar tests junto al source

> **Severidad:** 🔴 HIGH
> **Auditoría:** 36/52 tests (69%) planos en `tests/`, directorios `host/` y `shared/` sin correspondencia en `src/`
> **Principio:** El test de un archivo vive al lado del archivo que prueba

---

## Problema

- 36 archivos de test planos en `tests/` raíz
- `tests/host/` no tiene `src/host/` (mapea a `api/`, `core/`, `ui/`)
- `tests/shared/` no tiene `src/shared/` (mapea a `system/contracts/`)
- Inconsistencia: tests de Copilot/VSOpenCodeX planos, tests de Cursor en `tests/destinations/`
- Difícil ver qué archivos tienen test y cuáles no
- Si borras/refactorizas un archivo source, el test se queda huérfano

## Solución

**Co-location**: cada `*.test.ts` vive en la misma carpeta que su `*.ts` fuente.
Solo se mantiene `tests/integration/` para tests que cruzan múltiples módulos.

```
tests/
├── integration/             # se queda (multi-módulo)
└── webview/                 # se queda (React bundle separado)
```

```
src/core/suggest/
├── runSuggest.ts
├── runSuggest.test.ts       # co-located
└── index.ts

src/engines/ollama/
├── ollamaApiClient.ts
├── ollamaApiClient.test.ts  # co-located
├── ollamaLmEngine.ts
├── ollamaLmEngine.test.ts   # co-located
└── ...
```

---

## Subfases

### C1 — Actualizar configuración de Vitest

- [ ] Modificar `vitest.config.ts` (o `include` en `package.json`) para buscar tests en `src/**/*.test.ts` además de `tests/**/*.test.ts`
- [ ] Excluir `src/**/*.test.ts` del build de producción (tsconfig `exclude` o vite config)
- [ ] Verificar que los tests webview (`tests/webview/`) siguen funcionando

**Criterio de hecho:** `npx vitest run` encuentra tests tanto en `src/` como en `tests/`.

---

### C2 — Mover tests unitarios de `tests/` raíz a `src/`

| Test actual | Destino (co-located) |
|-------------|---------------------|
| `tests/webviewProtocols.test.ts` | `src/api/protocols/webviewProtocols.test.ts` |
| `tests/MiniInputViewProvider.test.ts` | `src/ui/provider/MiniInputViewProvider.test.ts` |
| `tests/completionInstruction.test.ts` | `src/core/prompt/completionInstruction.test.ts` |
| `tests/instructionNormalizeContract.test.ts` | `src/core/prompt/instructionNormalizeContract.test.ts` |
| `tests/completionSources.test.ts` | `src/core/routing/completionSources.test.ts` |
| `tests/GhostPromptSessionStore.test.ts` | `src/core/state/GhostPromptSessionStore.test.ts` |
| `tests/bootstrapStoredHelpers.test.ts` | `src/core/memory/bootstrapStoredHelpers.test.ts` |
| `tests/projectMemoryStore.test.ts` | `src/core/memory/projectMemoryStore.test.ts` |
| `tests/projectBootstrapContext.test.ts` | `src/core/memory/projectBootstrapContext.test.ts` |
| `tests/editorIngestLru.test.ts` | `src/core/memory/ingest/editorIngestLru.test.ts` |
| `tests/entriesMutation.test.ts` | `src/core/memory/entries/entriesMutation.test.ts` |
| `tests/suggestionLoadingUi.test.ts` | `src/core/presentation/suggestionLoadingUi.test.ts` |
| `tests/completionProvider.test.ts` | `src/engines/engineRegistry.test.ts` |
| `tests/engineRegistry.test.ts` | `src/engines/engineRegistry.test.ts` (unificar con anterior o mantener separado) |
| `tests/CopilotCompletion.test.ts` | `src/engines/copilot/CopilotCompletion.test.ts` |
| `tests/copilotStatus.test.ts` | `src/engines/copilot/copilotStatus.test.ts` |
| `tests/opencodeApiClient.test.ts` | `src/engines/opencode/opencodeApiClient.test.ts` |
| `tests/opencodeLmCompletion.test.ts` | `src/engines/opencode/opencodeLmCompletion.test.ts` |
| `tests/opencodeModelCatalog.test.ts` | `src/engines/opencode/catalog/opencodeModelCatalog.test.ts` |
| `tests/opencodeModelTier.test.ts` | `src/engines/opencode/catalog/opencodeModelTier.test.ts` |
| `tests/opencodeStatus.test.ts` | `src/engines/opencode/opencodeStatus.test.ts` |
| `tests/normalizeOpencodeProviderModels.test.ts` | `src/engines/opencode/catalog/normalizeOpencodeProviderModels.test.ts` |
| `tests/ollamaApiClient.test.ts` | `src/engines/ollama/ollamaApiClient.test.ts` |
| `tests/ollamaLmEngine.test.ts` | `src/engines/ollama/ollamaLmEngine.test.ts` |
| `tests/ollamaStatus.test.ts` | `src/engines/ollama/ollamaStatus.test.ts` |
| `tests/mergedModelCatalog.test.ts` | `src/engines/catalog/mergedModelCatalog.test.ts` |
| `tests/destinationRegistry.test.ts` | `src/destinations/destinationRegistry.test.ts` |
| `tests/copilotChatDestination.test.ts` | `src/destinations/copilotChat/copilotChatDestination.test.ts` |
| `tests/vsOpenCodeXDestination.test.ts` | `src/destinations/vsOpenCodeX/vsOpenCodeXDestination.test.ts` |
| `tests/vsOpenCodeXGhostPromptUiBridge.test.ts` | `src/destinations/vsOpenCodeX/vsOpenCodeXGhostPromptUiBridge.test.ts` |
| `tests/vsOpenCodeXStatus.test.ts` | `src/destinations/vsOpenCodeX/vsOpenCodeXStatus.test.ts` |
| `tests/notifyVsxAgentDestinationIfExtensionMissing.test.ts` | `src/destinations/vsOpenCodeX/notifyVsxAgentDestinationIfExtensionMissing.test.ts` |
| `tests/ProviderStatusManager.test.ts` | `src/core/status/ProviderStatusManager.test.ts` |
| `tests/SuggestionRequestGovernor.test.ts` | `src/system/policies/SuggestionRequestGovernor.test.ts` |

**Criterio de hecho:** No hay archivos `.test.ts` sueltos en `tests/` raíz.

---

### C3 — Dispersar `tests/host/` a su source real

| Test actual | Destino (co-located) |
|-------------|---------------------|
| `tests/host/applyWebviewUpdateSetting.test.ts` | `src/api/settings/applyWebviewUpdateSetting.test.ts` |
| `tests/host/ghostPromptSuggestPipeline.test.ts` | `src/core/suggest/ghostPromptSuggestPipeline.test.ts` |
| `tests/host/ghostPromptWebviewInboundHandlers.test.ts` | `src/api/protocols/ghostPromptWebviewInboundHandlers.test.ts` |
| `tests/host/suggestionHostNotification.test.ts` | `src/ui/notifications/suggestionHostNotification.test.ts` |

- [ ] Eliminar `tests/host/` tras migrar

**Criterio de hecho:** `tests/host/` no existe.

---

### C4 — Dispersar `tests/shared/`

| Test actual | Destino (co-located) |
|-------------|---------------------|
| `tests/shared/webviewMessageSchemas.test.ts` | `src/system/contracts/webviewMessageSchemas.test.ts` |

- [ ] Eliminar `tests/shared/` tras migrar

**Criterio de hecho:** `tests/shared/` no existe.

---

### C5 — Actualizar imports en todos los tests movidos

- [ ] Cada test movido: actualizar `../../src/` → `../` (o la profundidad correcta desde `src/`)
- [ ] Verificar que mocks con rutas relativas (`vi.mock('../../src/...')`) se actualizan a rutas del source (`vi.mock('../...')`)
- [ ] `tests/integration/providerStatusFlow.test.ts`: actualizar imports a `../../src/` (se queda en `tests/integration/`)
- [ ] `tests/webview/*.test.tsx`: verificar que siguen funcionando (bundle separado, no se mueven)

**Criterio de hecho:** `npx vitest run` ejecuta todos los tests sin errores de módulo.

---

### C6 — `npm run check` verde

- [ ] Ejecutar `npm run check`
- [ ] Corregir cualquier fallo

**Criterio de hecho:** `npm run check` pasa sin errores.

---

### C7 — Eliminar directorios vacíos de `tests/`

- [ ] Verificar que `tests/` solo contiene `integration/` y `webview/`
- [ ] Eliminar cualquier directorio vacío restante

**Criterio de hecho:** `tests/` tiene solo `integration/` y `webview/`.

---

## Estado

| Subfase | Estado |
|---------|--------|
| C1 — Config Vitest | [x] |
| C2 — Mover tests raíz | [x] |
| C3 — Dispersar `host/` | [x] |
| C4 — Dispersar `shared/` | [x] |
| C5 — Actualizar imports | [x] |
| C6 — `npm run check` verde | [x] |
| C7 — Limpiar directorios vacíos | [x] |

---

## Archivos resumen

| Acción | Cantidad |
|--------|----------|
| Tests a mover a `src/` | ~38 archivos |
| Directorios a eliminar | `tests/host/`, `tests/shared/` + raíz vacía |
| Directorios que se quedan | `tests/integration/`, `tests/webview/` |
| Config a actualizar | `vitest.config.ts`, `tsconfig.json` |
