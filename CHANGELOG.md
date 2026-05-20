# Changelog

All notable changes to this project are documented in this file.

## [0.6.2] - 2026-05-18

Consolidación boundary host↔webview (roadmap v0.6.2 FA–FC): una sola línea de contratos sobre `system/internals/protocols/` sin carpeta legacy `api/protocols/`.

### Added

- **Barrels webview:** `ui/webview/react/webviewProtocolConstants.ts` y `webviewProtocolSchemas.ts` para constantes `cons*` y schemas Zod del panel sin rutas profundas repetidas.
- **Paridad parse:** fixtures `webviewOutboundMessageFixtures.ts` y tests `parseWebviewInbound.test.ts` + ampliación de `api/boundary/webviewProtocols.test.ts` (mismo schema host→panel).
- **Longitud de pre-suggestion (FQ–FT):** slider 40–500 y cinco atajos (muy conciso → muy extenso) en chip Composición; presets 40 / 155 / 270 / 385 / 500; etiqueta derivada (`deriveSuggestionLengthLabel`); hints LM por banda en `buildCompletionInstruction`.

### Removed

- **`src/api/protocols/`** — shims duplicados de `api/boundary/` (handlers, tests, mocks).
- **`src/api/settings/applyWebviewUpdate.ts`** — duplicado; canónico en `system/internals/config/write/applyWebviewUpdateSetting.ts`.
- **`ghostPrompt.suggestionStyle`** — setting y enum `SuggestionStyle`; sustituido por `maxSuggestionChars` como única perilla de longitud.
- **`resolveEffectiveMaxSuggestionChars`** y factores por estilo; pipeline usa el tope configurado directamente.

### Changed

- **Imports `api/`:** parseo con logging y dispatch inbound solo desde `api/boundary/` (`api/index.ts` reexporta boundary).
- **Webview React:** hooks y componentes importan tipos/constantes vía barrels locales; `parseWebviewInbound.ts` documentado como validación de mensajes **host→panel** (`webviewOutboundMessageSchema`).
- **Default `ghostPrompt.maxSuggestionChars`:** 270 (preset Normal). Migración one-shot desde `suggestionStyle` al activar la extensión.

## [Unreleased]

### Added

- **Sistema de logging unificado** (`src/system/log/`): `Logger` por módulo, canal **GhostPrompt Log**, persistencia NDJSON + Markdown bajo `globalStorageUri/ghostPrompt/logs/v1/` con cola asíncrona y rotación gzip de `events.ndjson`; settings `ghostPrompt.logLevel`, `ghostPrompt.logFileEnabled`, `ghostPrompt.logFileMaxBytes`; shim `ghostPrompt.debugSuggestions` + `flushLogCapture` en el pipeline `suggest`. Sustituye `SuggestionDebug`, `SuggestionLog` y `ConversationLog`.

### Changed

- **Protocols v0.6.1:** contratos bajo `src/system/internals/protocols/` con prefijos de archivo (`cons*`, `guard*`, `type*`, `state*`, `zschem*`); schemas Zod canónicos en `zschemWebviewMessages.ts`; adaptador webview `parseWebviewInbound.ts`; símbolos sin prefijo `GHOST_PROMPT_*` (`AGENT_DESTINATION_IDS`, `parseAgentDestination`, `getAgentDestination`, …); `CompletionCancellationToken` sin import de `vscode` en protocols.
- **Fuentes de completado → `engines/`:** `getEnabledCompletionSources`, `getCompletionUiKind` en `engines/config/completionSources.ts`; `resolveCompletionSourceForRequest` y `CompletionSourceId` en `engines/routing/resolveCompletionSource.ts` y `engines/completionSourceId.ts`. Eliminados `system/internals/config/sources.ts` y `system/internals/protocols/routing.ts`.
- **Stream Copilot LM → `engines/copilot/`:** `collectLmResponse` en `engines/copilot/collectLmResponse.ts` (antes `system/internals/streaming/collect.ts` / `collectResponseText`). Carpeta `system/internals/streaming/` eliminada.
- **`system/internals/` reorganizado:** contratos en `protocols/types/` + `protocols/state/`; implementación en `state/` (`sessionStore`, `providerManager`). Eliminada carpeta `states/`.
- **Loading en `protocols/state/loading/`:** `loadingPhase.ts` + `loadingLabels.ts` (`suggestionLoadingStatusText`). Eliminado `state/loadingUi.ts`.
- **ESLint:** zonas `import/no-restricted-paths` actualizadas (`sugcore/`, `system/log/`, `engines/`); `npm run lint` y `npm run validate` en verde sin relajar reglas.
- **`src/core/routing/sources.ts`:** movido desde `src/core/sources.ts` (Fase G — routing); actualizar imports a `core/routing/sources` o seguir usando el barrel `core/index.ts`.
- **`src/core/contracts/completion.ts` + `types.ts`:** tipos y contratos de completion viven en `contracts/`; `types.ts` reexporta para compatibilidad.
- **`src/core/suggest/`** (antes `core/pipeline/`): orquestación del mensaje `suggest` en `runSuggest.ts` (antes `suggestPipeline.ts`), barrel `suggest/index.ts`; consumidores importan `core/suggest` o el barrel `core/index.ts`.
- **`src/core/prompt/`** (`instruction.ts`, `normalize.ts`, barrel `prompt/index.ts`): prompt LM y post-proceso defensivo; el barrel `core/index.ts` reexporta vía `./prompt`.
- **`src/core/presentation/`** (`loading.ts`, barrel `presentation/index.ts`): fases de carga host↔webview y textos de estado; el barrel `core/index.ts` reexporta `SuggestionLoadingPhase` / `suggestionLoadingStatusText` vía `./presentation`.
- **`src/core/streaming/`** (`collect.ts`, barrel `streaming/index.ts`): `collectResponseText` para el stream del LM de VS Code; el barrel `core/index.ts` reexporta vía `./streaming`.
- **`src/core/state/`** (`GhostPromptSessionStore.ts`): singleton host Sidebar+Panel (antes `core/session/`).
- **`src/core/language/`** (`index.ts`): detección y resolución de idioma (antes `language.ts` en raíz).
- **Limpieza `core/`:** eliminadas carpetas vacías `catalog/`, `pipeline/`, `session/` (restos previos a Fase G).
- **`projectBootstrapContext`:** movido de `src/core/context/` a `src/core/memory/projectBootstrapContext.ts`; carpeta `core/context/` eliminada.
- **`SuggestionRequestGovernor`:** movido de `src/core/governor/` a `src/system/policies/SuggestionRequestGovernor.ts`; carpeta `core/governor/` eliminada; importar desde `system/policies/...` (tests y referencia legacy).
- **`npm run validate` / `check`:** incluye `compile` antes de `verify:webview-bundle`, de modo que tras `npm run clean` (borra `out/`) la verificación del bundle no falle por falta de `out/system/build/verifyWebviewBundle.js`.

## [0.6.0] - 2026-05-14

Versión **0.6.0**: reorganización de owners del dominio **suggestion** (roadmap v0.6) — el barrel `core` deja de reexportar motores y catálogos; catálogo merged multi-motor bajo `engines/catalog/`; pipeline con umbral mínimo de entrada; governor legacy fuera del API público del barrel; documentación (`Owners`, `core/README`, `ARCHITECTURE`) y tests alineados.

### Changed

- **Catálogo merged de modelos** (`listMergedSuggestionModels`): de `src/core/catalog/` a `src/engines/catalog/mergedModelCatalog.ts`. Ya no se reexporta desde `src/core/index.ts`; importar desde `src/engines/...` o el barrel `engines`.
- **`api/settings/settingsPostMessage`**: listas por motor (`listSuggestionModels`, OpenCode, Ollama) importadas desde `engines/.../catalog`; tipos y routing de fuentes desde `core/types` y `core/routing/sources` (sin barrel `core/index`).
- **`api/getters/workspaceGetters`**: tipos desde `core/types` (sin barrel `core/index`).
- **Pipeline `suggest`** (`suggestPipeline.ts`): si el texto `trim` tiene menos de 3 caracteres, se emite `empty` con razón `too-short` sin llamar al LM ni fase `loading`.
- **Barrel `src/core/index.ts`**: deja de reexportar catálogo Copilot (`modelCatalog`), `requestCompletion`, tipo `CompletionProvider` y funciones del registry, listas OpenCode/Ollama, y `SuggestionRequestGovernor`. Consumidores: rutas explícitas `engines/...` o `system/policies/SuggestionRequestGovernor` (legacy).
- **`SuggestionRequestGovernor`**: en `src/system/policies/` para tests y referencia legacy; **no** participa en el pipeline `suggest` ni en el barrel `core/index.ts`.

## [0.5.3] - 2026-05-13

Versión **0.5.3**: `host/` desmantelado en dominios canónicos `api/` + `vscode/` + `core/pipeline/`. `projectMemory/` movido a `core/memory/` con subcarpetas.

### Changed

- **Desmantelado `src/host/` (10 archivos) en 3 dominios:**
  - **`src/api/`** — API interna webview↔host (6 archivos + barrel):
    - `api/protocols/webviewProtocols.ts` — Validación Zod boundary postMessage
    - `api/protocols/inboundHandlers.ts` — Router/dispatch mensajes inbound
    - `api/settings/settingsPostMessage.ts` — Build + post settings al webview
    - `api/settings/applyWebviewUpdate.ts` — Aplica `updateSetting` via config API
    - `api/getters/workspaceGetters.ts` — Lectores `vscode.workspace.getConfiguration`
    - `api/index.ts` — Barrel público
  - **`src/vscode/`** — Integración VS Code (3 archivos + barrel):
    - `vscode/MiniInputViewProvider.ts` — `WebviewViewProvider` (sidebar + panel)
    - `vscode/webviewHtml.ts` — HTML template + CSP nonce generation
    - `vscode/suggestionNotification.ts` — `vscode.window.showWarningMessage` notifications
    - `vscode/index.ts` — Barrel público
  - **`src/core/pipeline/`** — Orquestación (2 archivos):
    - `core/pipeline/suggestPipeline.ts` — Pipeline completo: governor → LM → broadcast
    - `core/pipeline/index.ts` — Barrel + re-export

- **Movido `src/projectMemory/` → `src/core/memory/` con subcarpetas:**
  - `memory/io/` — Storage IO (fs adapter, JSON, workspace key, path)
  - `memory/entries/` — Entry operations (mutation, bootstrap, editor)
  - `memory/ingest/` — Editor ingest (document, settings, LRU)
  - `memory/probes/` — Workspace context (file probes, file watchers)
  - 17 archivos planos → 16 archivos en estructura organizada

- **Config fixes:**
  - Version bumped to `0.5.3`
  - `package.json`: `verify:webview-bundle` apunta a `out/system/build/`
  - `.eslintrc.json`: zones actualizados (`system/debug/`, `core/memory/` → no `api/`, `vscode/`)
  - `.vscodeignore`: `out/system/build/**` en vez de `out/build/**`
  - `webview/tsconfig.json`: include path actualizado a `system/contracts/`

- **Todos los imports actualizados:** `extension/`, `vscode/`, `core/pipeline/`, tests
- **226 tests passing**, `npm run check` verde (0 errors, 34 warnings pre-existing)

### Added

- **Ollama placeholder "no disponible":** cuando el servidor Ollama no responde, aparece `Ollama (no disponible)` en el selector de modelos en vez de desaparecer de la lista (`src/engines/ollama/catalog/ollamaModelCatalog.ts`)

### Changed

- **Movido `webview/` (root) → `src/ui/webview/`:** todo el código del webview sandbox bajo `src/`:
  - `index.html`, `style.css`, `tsconfig.json`, `main.ts`, `globals.d.ts`
  - `lib/composeLabels.ts`, `lib/htmlEscape.ts`, `lib/userErrorMessage.ts`
  - `protocol/postToHost.ts`
  - Subcarpeta `panels/` para futura extracción de lógica de capacidades
- **Disuelto `src/vscode/`** → `src/ui/provider/` (MiniInputViewProvider, webviewHtml) + `src/ui/notifications/` (suggestionNotification)
- **Creado `src/ui/README.md`:** documentación del dominio UI con subdominios webview/provider/notifications
- **`tsconfig.json` raíz:** excluye `src/ui/webview` (tiene su propio tsconfig con `lib: ["DOM"]`)
- **ESLint zones:** actualizadas de `vscode/` a `ui/provider/` y `ui/notifications/`
- **Todos los paths actualizados:** `package.json` scripts, `webviewHtml.ts`, `MiniInputViewProvider.ts`, `verifyWebviewBundle.ts`, tests

## [0.5.2] - 2026-05-13

Versión **0.5.2**: OpenCode reestructurado como **API client tipo Ollama** — sin runtime embebido, sin gestión de procesos. Conexión a instancia OpenCode ya corriendo via `@opencode-ai/sdk`.

### Changed

- **OpenCode como API client (Fases A-I):**
  - Nuevo `engines/opencode/opencodeApiClient.ts`: `createOpenCodeClient` (dynamic import ESM), health check via `config.get()`, session pool con TTL (5min) y max-size (4), `promptOpenCode`, `promptStreamOpenCode`, `getSession`, `closeAllSessions`.
  - Nuevo `engines/opencode/opencodeLmEngine.ts`: `requestOpencodeCompletion` integrado con `CompletionProvider` interface.
  - Catálogos OpenCode movidos a `engines/opencode/catalog/` (opencodeModelCatalog, normalizeOpencodeProviderModels, opencodeModelTier).
  - Puerto por defecto: **4096** (configurable via `ghostPrompt.opencodePort`). Auth via `ghostPrompt.opencodeAuthToken`.
  - 19 nuevos tests: `opencodeApiClient.test.ts` (9), `opencodeLmCompletion.test.ts` (8), `opencodeModelCatalog.test.ts` (5).

- **Eliminado `src/opencode/` completo (16 archivos):**
  - Runtime embebido (`OpenCodeRuntime.ts`), CLI detection, lifecycle, warm-up, SSE streams, session inline pool, LM queue, providers snapshot, sdkEnvelope, constants.
  - Tests eliminados: `openCodeCli.test.ts`, `opencodeProvidersSnapshot.test.ts`, `opencodeProvidersSnapshot.perf.test.ts`, `opencodeSuggestionStream.test.ts`, `nodeFetchDuplex.test.ts`, `vsOpenCodeXBridge.test.ts`, `opencodeSseDebug.test.ts`, `sdkEnvelope.test.ts`, `opencodeSuggestions.integration.test.ts`, `openCodeRuntimeVsxNoEmbedded.test.ts`.

- **Eliminado `vsOpenCodeXConnection.ts`:** puente de conexión a VSOpenCodeX ya no necesario. `VS_OPEN_CODE_X_EXTENSION_ID` movido a `destinationRegistry.ts`.

- **Settings eliminados:** `ghostPrompt.preferVsOpenCodeXOpenCode`, `ghostPrompt.vsOpenCodeXProbeDelayMs`, `ghostPrompt.vsOpenCodeXConnectionMaxAttempts`, `ghostPrompt.vsOpenCodeXConnectionRetryGapMs`.

- **`extension.ts` simplificado:** eliminada gestión de runtime OpenCode, sync from config, stop en deactivate. Ahora usa `resetClient()` del apiClient.

- **`MiniInputViewProvider.ts` simplificado:** eliminado `warmOpenCodeRuntimeIfConfigured()`.

### Structural cleanup (Fases 1-9)

- **Catálogos engine-specific movidos a `engines/*/catalog/`:**
  - `modelCatalog.ts` → `engines/copilot/catalog/modelCatalog.ts` (Copilot-specific)
  - `normalizeOllamaModels.ts` + `ollamaModelCatalog.ts` → `engines/ollama/catalog/` (Ollama-specific)
  - `mergedModelCatalog.ts` aplanado a `completion/mergedModelCatalog.ts` (cross-engine)
  - Carpeta `completion/catalog/` eliminada

- **Eliminado `completion/completionProvider.ts`:** re-export redundante de 6 líneas; imports ahora directo desde `engines/engineRegistry`.

- **Barrels completos:**
  - `destinations/index.ts` creado (re-exporta `destinationRegistry`, `copilotChatDestination`, `vsOpenCodeXDestination`)
  - `engines/index.ts` completado (agrega re-exports de `copilot/` y `opencode/`)

- **ESLint limpio:** eliminada regla huérfana `src/opencode/**/*` de `.eslintrc.json`.

- **README actualizado:** eliminadas referencias a servidor embebido, puerto 17433, warm-up, lifecycle, y settings VSOpenCodeX coexistence. Puerto actualizado a 4096, conexión descrita como API client.

### Core/system reorganization (Fases 1-8)

- **Nuevo `src/core/`** — Lógica pura de suggestions (13 archivos):
  - `types.ts`, `instruction.ts`, `normalize.ts`, `streaming.ts`, `language.ts`, `loading.ts` (renamed from `suggestionLoadingUi`), `sources.ts` (renamed from `completionSources`), `index.ts`
  - `catalog/mergedModelCatalog.ts`, `governor/SuggestionRequestGovernor.ts`, `session/GhostPromptSessionStore.ts`, `context/projectBootstrapContext.ts`

- **Nuevo `src/system/`** — Infra transversal (5 archivos):
  - `debug/SuggestionDebug.ts`, `log/ConversationLog.ts`, `log/SuggestionLog.ts`, `contracts/webviewMessageSchemas.ts` (renamed from `shared/`), `build/verifyWebviewBundle.ts`

- **Carpetas eliminadas (7):** `completion/`, `governor/`, `session/`, `debug/`, `log/`, `shared/`, `build/`

- **Todos los imports actualizados:** `src/` (engines, host, extension, destinations, projectMemory), `tests/` (16 files), `webview/` (postToHost.ts)

- **226 tests passing**, `npm run check` verde (0 errors, 34 warnings pre-existing)

## [0.5.1] - 2026-05-13

Versión **0.5.1**: integración de **Ollama** como tercer motor de suggestions (local, offline-first). Refactor de la arquitectura de motores a carpeta canónica `src/engines/`.

### Added

- **Ollama engine (Phases 1-5):** nuevo motor de completado local vía HTTP REST contra `ollama serve`. Incluye:
  - Cliente API (`ollamaApiClient.ts`): `listModels()` (GET /api/tags) y `generate()` (POST /api/generate) con streaming SSE opcional.
  - Adaptador `ollamaLmEngine.ts`: resolución automática de modelo desde `listModels`, respeta `ollamaExcludedModelIds`, fases de loading `ollama-start`/`ollama-generating`.
  - Catálogo `ollamaModelCatalog.ts`: lista modelos desde /api/tags, normaliza a `SuggestionModelDescriptor`.
  - Routing: `looksLikeOllamaModelId` detecta `model:tag` (contiene `:` sin `/`).
  - Settings: `ghostPrompt.ollamaBaseUrl` (default `http://localhost:11434`), `ghostPrompt.ollamaExcludedModelIds`.
  - Webview UI: selector de motor incluye "Ollama", modelos agrupados bajo bucket "Ollama" (entre OpenCode y Other).

- **Arquitectura `src/engines/` (Phase 1):** carpeta canónica para todos los motores de completion:
  - `engines/copilot/copilotLmEngine.ts`, `engines/opencode/opencodeLmEngine.ts`, `engines/ollama/*`.
  - `engineRegistry.ts`: interfaz `CompletionProvider` + `getCompletionProviderForSource()`.
  - `completion/completionProvider.ts` convertido en reexport desde `engineRegistry`.
  - Antiguos `completion/providers/` eliminados.

- **Tests (Phase 6):** 35 nuevos tests unitarios:
  - `ollamaApiClient.test.ts`: mock fetch, testea listModels y generate (éxito, HTTP error, network error, custom baseUrl).
  - `ollamaLmEngine.test.ts`: mock api client, 11 tests (modelo explícito, auto-resolve, exclusión, errores, loading phases).
  - `completionSources.test.ts`: +5 tests (legacy ollama, enabledSources con ollama, routing Ollama/Copilot/OpenCode, `looksLikeOllamaModelId`).
  - `mergedModelCatalog.test.ts`: merge con modelos Ollama, dedup, propagación de errores.
  - `engineRegistry.test.ts`: `getCompletionProviderForSource` con ollama.

### Changed

- **Engine routing:** `resolveCompletionSourceForRequest` ahora enruta `model:tag` (Ollama), `providerID/modelID` (OpenCode), otros (Copilot).
- **Provider grouping en webview:** orden de buckets: Copilot → OpenCode → Ollama → Otros.
- **Ownership:** `Owners.md` actualizado con `engines/` y cobertura de tests.

### Destinations refactor (Phase 7)

- **Nueva carpeta `src/destinations/`:** carpeta canónica para destinos de prompt (análoga a `src/engines/`):
  - `destinations/copilotChat/copilotChatDestination.ts`: `sendToChat()` + autoregistro en `destinationRegistry`.
  - `destinations/vsOpenCodeX/vsOpenCodeXDestination.ts`: `forwardGhostPromptInlineUiToVsOpenCodeIfApplicable()`, `notifyIfVsxAgentDestinationWithoutVsOpenCodeX()` + autoregistro.
  - `destinationRegistry.ts`: interfaz `DestinationProvider`, `registerDestination()`, `getDestinationProviderForId()`, `getActiveDestinationProvider()`.
- **`vsOpenCodeXBridge.ts` → `engines/opencode/vsOpenCodeXConnection.ts`:** movido a `engines/opencode/`.
- **`bridge/ChatBridge.ts` eliminado:** funcional reemplazado por `copilotChatDestination`.
- **`ghostPromptWebviewInboundHandlers.ts`:** actualizado para usar `getGhostPromptAgentDestination()` y `getActiveDestinationProvider()` desde `destinationRegistry`.
- **Getters migrados:** `getGhostPromptAgentDestination()` + `isVsOpenCodeXExtensionInstalled()` reexportados desde `destinationRegistry` (backward compat via re-export en `ghostPromptHostWorkspaceGetters.ts`).
- **Tests:** +15 nuevos tests (`destinationRegistry.test.ts`, `copilotChatDestination.test.ts`, `vsOpenCodeXDestination.test.ts`). Total 245.

### Docs

- `Docs/ARCHITECTURE.md`: diagrama actualizado con Ollama, módulo `engines/` en tabla, pipeline con rama Ollama, sección "Why Ollama".
- `Docs/Integrations/GhostPrompt-motor-destino-matrix.md`: Situaciones 5 y 6 (Motor Ollama · Destino Copilot / VSOpenCodeX).
- `Docs/Plans/Roadmaps/Roadmap-v0.5.1-ollama-integration.md` (full integration roadmap).
- `Docs/Plans/Roadmaps/Roadmap-v0.5.1-ollama.md` (shipped summary).
- `CHANGELOG.md`: entrada v0.5.1.

Versión **0.5.0**: integración VSOpenCodeX (host), destino agente, coexistencia OpenCode sin `opencode serve` embebido cuando VSX está instalada y **prefer** activo, debounce webview por defecto **800 ms**, selector **Destino** en la webview. Incluye el trabajo de OpenCode perf / colas que estaba preparado para **0.4.1**. Última versión en marketplace de referencia en documentación: **[0.4.0]** (ajusta la nota si ya publicaste **0.4.1**).

### Added

- **Agent destination + VSX surface (roadmap v0.5 — Fase C, lado GhostPrompt):** **`ghostPrompt.agentDestination`** (`copilotChat` | `vsOpenCodeX`). Con **`vsOpenCodeX`**, la webview oculta composer inline y envío a Copilot; se mantienen chips de configuración. Reenvío de UI de suggestion al comando **`vsopencodex.ghostPromptInlineUi`**; VSX puede disparar el pipeline con **`ghostPrompt.runSuggestPipeline`** (`{ text }`). Contrato y estado E2E: **`Docs/Plans/Roadmaps/Roadmap-v0.5-vsopencodex-coexistence.md`**. Aviso informativo (una vez por sesión de ventana) si el destino es VSX y la extensión **`jaminsmoke.vsopencodex`** no está cargada.

- **VSOpenCodeX coexistence (roadmap v0.5 — Fases A+B):** when **VSOpenCodeX** (`jaminsmoke.vsopencodex`) is installed and exposes `vsopencodex.getOpenCodeConnection`, GhostPrompt can attach the `@opencode-ai/sdk` client to that OpenCode server instead of spawning its own **`opencode serve`**. Settings: **`ghostPrompt.preferVsOpenCodeXOpenCode`** (default enabled), **`ghostPrompt.vsOpenCodeXProbeDelayMs`** (default `800`; `0` = no delay), **`ghostPrompt.vsOpenCodeXConnectionMaxAttempts`** (default `8`), **`ghostPrompt.vsOpenCodeXConnectionRetryGapMs`** (default `650`). GhostPrompt **retries** `getOpenCodeConnection` that many times while VSX starts. **If VSX is installed** and **prefer** is on, GhostPrompt **does not** start the embedded server after retries (no port grab); user message explains opening VSX or disabling **prefer**. **If VSX is not installed**, embedded **`OpenCodeRuntime`** is used as before. Debug: **`cold-start-begin`** = embedded spawn only; **`opencodex-attach-begin`** / **`vsopencodex-probe-start`**. Documentation: **`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`**.

- **OpenCode debug perf (roadmap phase I):** cuando **`ghostPrompt.debugSuggestions`** está activo y el motor es OpenCode, el canal **GhostPrompt Suggestions** escribe hitos **`[opencode-perf]`** correlacionados por `captureId` (snapshot de proveedores en caché o red, sesión inline pool/create, `prompt`, primer delta SSE en streaming, cierre del consumidor SSE, total del LM). Con debug desactivado no hay emisión adicional por esta fase.

### Docs

- README: **`ghostPrompt.agentDestination`**, contrato GP↔VSX (`ghostPrompt.runSuggestPipeline` / `vsopencodex.ghostPromptInlineUi`), enlace al roadmap v0.5.
- README: modo debug — líneas **`[opencode-perf]`** con OpenCode activo (§ Debug mode).
- Roadmap [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md): fases **G–J** cerradas en documentación (catálogo, sesión, telemetría debug, notas de release).

### Changed

- **Suggestion debounce:** `ghostPrompt.suggestionDebounceMs` default **400 → 800** ms (menos carreras con VSOpenCodeX / OpenCode al teclear).
- **Destino agente en webview:** si VSOpenCodeX está instalada, fila **Destino** junto a **Motor** (`<select>` Copilot Chat / VSOpenCodeX); settings incluyen `vsOpenCodeXExtensionInstalled`. Si el usuario nunca guardó `agentDestination`, el efectivo es **vsOpenCodeX** cuando VSX está instalada (`inspect` + `getExtension`).
- **Mantenibilidad (`Owners` fase B):** subcarpetas `src/completion/catalog/` (listados y tiers de modelo) y `src/completion/context/` (bootstrap proyecto); exports públicos siguen en `completion/index.ts`.

### Fixed

- **OpenCode latencia concurrente:** cola serie para **`requestOpencodeCompletion`** (`opencodeInlineCompletionQueue`): evita dos **`session.prompt`** a la vez en la misma sesión pooled cuando llegan suggerencias rápidas (telas de ~7–12 s, timeouts al límite y primer SSE muy tardío). La reserva pooled ya **no se invalida** solo por cancelación por tecla nueva; sí tras **timeout** del LM (~12 s por petición), errores de sobre o otros caminos de error ya existentes.

## [0.4.0] - 2026-05-10

### Added

- **Project memory (per workspace folder):** JSON store under extension **`globalStorageUri`** at `ghostPrompt/projectMemory/v1/` — `registry.json`, per-repo `stores/<sha256>/entries.json` + `manifest.json`. Bootstrap excerpts (`README*` / `package.json`) and optional **editor-ingest** excerpts; LRU and byte caps; hash/mtime validation on reconcile.
- **Commands:** `GhostPrompt: Clear Project Memory (This Workspace)` removes the on-disk store for the current workspace root.
- **GC:** unused workspace stores removed after `ghostPrompt.projectMemoryUnusedStoreTtlDays` (default 30 days).
- **File watchers (phase E):** one `FileSystemWatcher` per indexed path; opt-out `ghostPrompt.projectMemoryFileWatcherEnabled`; throttle `projectMemoryFileWatcherThrottleMs`.

### Changed

- **`contextMode: project`:** when project memory is enabled, suggestion prompts can include reconciled bootstrap + editor lines; governor cache scope includes a bootstrap fingerprint.
- **Settings:** many `ghostPrompt.projectMemory*` keys — see README and `package.json` `markdownDescription` fields.
- **OpenCode performance (roadmap phase G):** in-memory **`config.providers()`** snapshot (`opencodeProvidersSnapshot`) with single-flight concurrency; warm-up prefetches catalog; invalidated on **`deactivate`**. Drop-down and **`requestOpencodeCompletion`** reuse the same cache (fewer RPCs per keystroke).
- **OpenCode performance (roadmap phase H):** pooled **inline suggestion session** per embedded-server lifecycle (`deploymentId` + **`openCodeServerLifecycleHooks`**); **`session.delete` removed from the successful request path**; pool cleared on server reset, timeouts/cancellation, prompt/create errors.

### Docs

- README: privacy / on-disk locations, project memory settings summary, manual QA checklist for v0.4.
- `Docs/ARCHITECTURE.md`: project memory storage layout and module pointers.
- Roadmap [`Roadmap-v0.4-project-context-store.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-project-context-store.md): phases A–F closed.
- Roadmap [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md): phases **G–H** (catalog cache + pooled inline session); README note on reload after external OpenCode config changes.

## [0.3.1] - 2026-05-09

### Added

- **Webview protocols:** Zod validation at host boundaries (`src/host/webviewProtocols.ts`), dependency **`zod`**; inbound/outbound message parsing in `MiniInputViewProvider`.
- **Tests:** `webviewProtocols.test.ts`, `webviewToolbarParity.test.ts`, `webviewThemeTokens.test.ts`; dual-view `refreshSettingsAllViews` regression.

### Changed

- **Toolbar UX:** Style, context, and language controls grouped in a **`<details>`** menu (`compose-options-details`) with live summary text; `Escape` closes the menu; chip click closes after selection.
- **Theming:** Webview CSS avoids hardcoded error color fallbacks; widget borders fall back to `transparent` when tokens are absent.

### Docs

- [`Roadmap-v0.3.1-webview-parity-contracts-ux.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md): Phases A–D (parity, contracts, compose menu, QA manual RC).
- README: version badge **0.3.1**.

## [0.3.0] - 2026-05-09

### Added

- **OpenCode (optional backend):** `ghostPrompt.completionProvider` (`copilot` | `opencode`), dedicated embedded OpenCode server (default loopback port **17433**), CLI probe (`opencode --version`), `providers/opencodeLmCompletion`, webview model list from `config.providers()`, `ghostPrompt.opencodeExcludedModelIds`, and a **Motor:** badge (Copilot LM vs OpenCode). Depends on [`@opencode-ai/sdk`](https://www.npmjs.com/package/@opencode-ai/sdk); see [OpenCode docs](https://opencode.ai/docs/sdk).
- **Tests (no network):** `tests/opencodeModelCatalog.test.ts`, `tests/opencodeLmCompletion.test.ts` mock `OpenCodeRuntime` / SDK envelope responses.

### Changed

- **Extension host layout:** `src/` reorganized into `extension/`, `host/`, `session/`, `completion/`, `governor/`, `bridge/`, `log/`, `debug/`; package entry `out/extension/extension.js`.
- **Completion domain:** split monolith into `types`, `instruction`, `normalize`, `language`, `streaming`, `modelCatalog`, `providers/copilotLmCompletion`, `completionProvider`; public barrel `src/completion/index.ts` (historical imports from `CopilotCompletion` path removed — use `../completion`).
- **Pluggable completions:** `CompletionProvider` + `getActiveCompletionProvider()` + `getCompletionProviderKind()`; `MiniInputViewProvider` delegates to Copilot LM or OpenCode and refreshes model chips when `ghostPrompt.*` changes.
- **VSIX packaging:** `npm run vsix` runs `vsce package` **with** dependencies so `@opencode-ai/sdk` ships inside the VSIX.

### Docs

- `ARCHITECTURE.md`, `Roadmap-v0.3.0-architecture.md`: Phases A–C (structure + refactor + release).
- README: completion provider section, OpenCode prerequisites, settings reference.
- [`Roadmap-v0.3-opencode-integration.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md): Phases 1–4 completed.

### Notes

- **Git tag:** annotated tag `v0.3.0` remains optional until you cut the release; the VSIX can be built anytime with `npm run vsix`.

## [0.2.5] - 2026-05-09

### Added

- `GhostPromptSessionStore` as single host source of truth for draft, pending suggestion, flow status, capture id, and shared cancellation across Sidebar + Panel webviews.
- Webview sync protocol: `draftChanged` / `draftSync` / `draftHydrate`, `broadcast` suggestion UI (`loading`, suggestion, empty/error, effective language).
- Optional `window.__ghostPromptCapabilities` (injected HTML) with `compactToolbar` CSS hook for future layout tweaks without breaking default parity.

### Changed

- Both GhostPrompt surfaces now mirror settings and suggestion state immediately (`_broadcastSettingsToAllViews`, `_broadcastUi`).
- Control strip uses flex wrap and full-width hints for narrow sidebar/panel widths; debug chip `aria-label` / `aria-pressed`.
- `suggestionStyleDirective()` exposes stable `STYLE_CONCISE` / `STYLE_BALANCED` / `STYLE_DETAILED` instruction fragments; `buildCompletionInstruction` consumes them.

### Docs

- README and roadmap `v0.2.4b` updated for unified session; Sprint 6 smoke checklist in [`Roadmap-v0.2.4b.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md).

## [0.2.4] - 2026-05-08

### Added

- Runtime pricing metadata exposure in suggestion model descriptors (`pricing`, e.g. `0x`, `0.33x`, `1x`) for UI transparency.
- Included/Premium/Unknown tier rendering in webview model selector and runtime model label.
- Loading spinner in status line while a suggestion request is in progress (`Buscando sugerencia...`).

### Changed

- Model tier classification now prioritizes passive pricing metadata (no active model probing required).
- Safe policy behavior (`nonPremiumOnly`) now targets included models (`pricing=0x`) when metadata exists, with conservative fallback.
- Empty reason terminology updated from `no-non-premium-model` to `no-included-model`.
- Model selector deduplicates repeated entries that resolve to the same visible model/tier/pricing combination.
- Model selector options are grouped by inferred provider and sorted for faster scanning.
- Tier visualization refined for readability using compact textual tokens (`[INCLUDED 0x]`, `[PREMIUM 1x]`, `[UNKNOWN]`) instead of dot indicators.
- Slow or stalled model responses now fail gracefully with timeout feedback instead of indefinite loading.
- Suggestion preview/accept flow now treats host normalization as the single source of truth, removing extra spacing heuristics in webview that could split words (`apli cacion`-style artifacts).
- Completion instruction now explicitly guides leading-space behavior: add one space for a new word, keep no leading space when completing an unfinished word.
- Product version bumped to `0.2.4`.

### Known issues

- `gpt-5-mini` and `raptor` may timeout in some sessions and return no suggestion. GhostPrompt now exits cleanly from loading state and shows a retry/model-switch hint.

### Docs

- README updated for `0.2.4` with pricing-aware tier behavior and terminology alignment.
- Debug guide updated to reflect `no-included-model`.
- Development audit tooling documented as isolated under `Scripts/` (not part of packaged extension).

## [0.2.3] - 2026-05-08

### Added (0.2.2)

- Model selector redesign in webview with explicit per-model tier labels (`Included` / `Premium`).
- Runtime model status label in webview (`Modelo: ... [Included/Premium]`).
- Scoped governor key dimensions to avoid cache collisions across language/style/context/model settings.

### Changed (0.2.2)

- Suggestion boundary normalization after punctuation (`:`, `;`, `,`, `.`, `!`, `?`) for cleaner inline continuation spacing.
- Language auto-resolution stability with confidence-aware detection, hysteresis, and fallback to previous/manual language.
- Preferred model selection persisted via `ghostPrompt.selectedModelId` and respected by model selection policy.

### Validation (0.2.2)

- `npm run check` passing (`lint` + `compile` + `test`).
- VSIX packaging verified for `ghost-prompt-0.2.3.vsix`.

## [0.2.2] - 2026-05-08

### Added

- Project-aware context mode (`ghostPrompt.contextMode=project`) including workspace, active file/language, and selection excerpts.
- Suggestion language controls:
  - `ghostPrompt.suggestionLanguageMode` (`auto` | `manual`)
  - `ghostPrompt.suggestionLanguage` (`es` | `en`)
- Language selector chips in webview (`Auto`, `ES`, `EN`) with effective-language feedback in auto mode.
- New roadmap for v0.2.2 in `Docs/Plans/Roadmaps/Roadmap-v0.2.2.md`.
- Additional tests for language detection/precedence and host-webview flow.

### Changed

- Request governor defaults tuned for longer sessions:
  - `requestCooldownMs`: `700 -> 500`
  - `rateLimitMaxRequests`: `40 -> 90`
  - `sessionRequestBudget`: `120 -> 300`
- Completion instruction now enforces output language and prevents translation of code identifiers/paths/API names.
- Ghost-text pipeline improved:
  - overlap and partial-word normalization in completion output
  - safer punctuation/spacing boundary handling when accepting with `Tab`
  - inline preview aligned with inserted text behavior
- README media paths updated to `media/img/*` and banner integrated.

### Fixed (0.2.1)

- Reduced cases where ghost suggestion text appeared glued to previous words.
- Improved consistency between inline rendering and accepted insertion output.

### Validation

- `npm run check` passing (`lint` + `compile` + `test`).

## [0.2.1] - 2026-05-07

### Fixed

- Ghost UI spacing/focus fixes and suggestion normalization refinements.

## [0.2.0] - 2026-05-07

### Added (0.2.0)

- Inline ghost-text suggestions in the webview mini composer.
- Request governor (dedupe, cache, cooldown, rate limit, session budget).
- Suggestion style controls and session context controls.
- Debug tooling and test suite baseline.

## [0.0.1] - Initial release

- Dual-panel registration and first ghost-text completion flow via `vscode.lm`.
