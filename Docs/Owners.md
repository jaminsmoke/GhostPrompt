# GhostPrompt — Ownership y límites entre capas (`src/`)

Documento vivo: actualizarlo cuando **mueva carpetas**, **añada zonas ESLint** o **cambien tests de contrato**.

---

## Cómo usar este doc antes de cada fase de refactor

1. **Identificar** en la tabla [Fases propuestas](#fases-propuestas-de-refactor-y-comprobaciones-previas) qué áreas de `src/` vas a tocar.
2. **Revisar** el mapa [Cobertura de tests por carpeta](#mapa-de-cobertura-tests--src) y ejecutar `npm run test` (o los ficheros listados).
3. Si falta cobertura para el comportamiento que vas a extraer o mover:
   - **añadir** tests nuevos, o
   - **ampliar** tests existentes en la misma PR **antes** del refactor mecánico.
4. Tras mover código: `npm run check`; actualizar **esta página** (matriz, mapa o fase).

**Principio:** el refactor solo **desplaza** responsabilidades ya cubiertas por tests de comportamiento (directos o de integración host↔mock LM).

---

## Matriz de ownership (quién es dueño de qué)

Filas = carpetas principales de `src/`. Columnas = reglas de dependencia y rol.

| Carpeta `src/`          | Rol                                                                                                                                                                                                                                                                                                                                                                                   | Depende típicamente de                                                                                                                                | No debe importar desde                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **`ui/`**               | Interfaz de usuario. `ui/webview/` (sandbox navegador), `ui/provider/` (WebviewViewProvider, HTML/CSP), `ui/notifications/` (alertas host).                                                                                                                                                                                                                                           | `core/`, `api/`, `destinations/`.                                                                                                                     | No meter aquí lógica de negocio de suggestion.                          |
| **`extension/`**        | Punto de entrada; registra comandos y vistas; lifecycle `activate` / `deactivate`.                                                                                                                                                                                                                                                                                                    | `ui/provider/`, `core/memory/`, `engines/opencode`, `system/debug`.                                                                                   | Evitar lógica de negocio pesada aquí (mantener delgado).                |
| **`api/`**              | API interna webview↔host: protocolos Zod, inbound handlers, settings flow, workspace getters.                                                                                                                                                                                                                                                                                         | `core/`, `engines/`, `system/`, `destinations/`, `vscode` (config API).                                                                               | No importar desde `vscode/` (providers).                                |
| **`core/`**             | Dominio **suggestions** (valor del producto): tipos/contratos, **`prompt/`**, **`presentation/`** (fases de carga host↔webview), **`streaming/`**, **`language/`**, **`state/`** (singleton host), `routing/sources`, context bootstrap, orquestación `suggest/`; governor legacy exportado. **No** incluye el merge de listas multi-motor (`engines/catalog/mergedModelCatalog.ts`). | `engines/` (registry, tipos cruzados), `system/debug/`, `vscode` (Uri types).                                                                         | No UI webview ni HTML; no VS Code API de producto en reglas de negocio. |
| **`engines/`**          | Motores `CompletionProvider` (`copilot/`, `opencode/`, `ollama/`) + `engineRegistry.ts` + **`catalog/mergedModelCatalog.ts`** (lista unificada para settings/UI).                                                                                                                                                                                                                     | `core/` (types, `routing/sources`, `prompt/`, `presentation/`, `streaming/`, `language/`, `state/`, vía imports de motor), `system/debug/`, `vscode`. | No importar desde `api/` como capa superior (evitar ciclos).            |
| **`destinations/`**     | Destinos de prompt (copilotChat, vsOpenCodeX). Registro `DestinationProvider` en `destinationRegistry.ts`.                                                                                                                                                                                                                                                                            | `vscode`.                                                                                                                                             | No importar desde `host/`, `api/`, `vscode/`.                           |
| **`core/memory/`**      | Memoria persistente del proyecto: store JSON, reconcile, ingest, watchers, GC.                                                                                                                                                                                                                                                                                                        | `vscode`, `system/debug`.                                                                                                                             | `api/`, `vscode/` (riesgo de cycle conceptual; pasar datos como deps).  |
| **`system/debug/`**     | Canal de salida y toggles de debug.                                                                                                                                                                                                                                                                                                                                                   | `vscode`.                                                                                                                                             | `api/`, `vscode/`.                                                      |
| **`system/log/`**       | Persistencia conversación / suggestions en disco.                                                                                                                                                                                                                                                                                                                                     | `vscode`, FS.                                                                                                                                         | —                                                                       |
| **`system/contracts/`** | Schemas/tipos compartidos host ↔ webview (Zod).                                                                                                                                                                                                                                                                                                                                       | `zod`.                                                                                                                                                | `api/` en runtime del webview bundle (el cliente es otro build).        |
| **`system/build/`**     | Scripts de verificación empaquetado (ej. webview bundle).                                                                                                                                                                                                                                                                                                                             | Node.                                                                                                                                                 | —                                                                       |

### ESLint (`import/no-restricted-paths`)

Reglas en `.eslintrc.json` (nivel `warn`):

| Objetivo (`target`)            | No importar desde (`from`)                    |
| ------------------------------ | --------------------------------------------- |
| **`src/core/memory/**/\*`\*\*  | **`src/vscode/**/_`**, **`src/api/\*\*/_`\*\* |
| **`src/system/debug/**/\*`\*\* | **`src/vscode/**/_`**, **`src/api/\*\*/_`\*\* |

---

## Mapa de cobertura (tests ↔ `src/`)

No es cobertura de líneas al 100 %; es **contrato de tests que deben seguir pasando** cuando se toca cada zona.

| Área `src/`                                                                                                           | Ficheros de test relevantes (Vitest)                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/extension.ts`                                                                                              | Parcialmente indirecto: `MiniInputViewProvider.test.ts` (registro webview); integración opcional.                                                                                                                                                                                                                                               |
| `ui/` (webview, provider, notifications)                                                                              | `MiniInputViewProvider.test.ts`, `webviewToolbarParity.test.ts`, `webviewThemeTokens.test.ts`, `tests/webview/App.test.tsx`, `host/suggestionHostNotification.test.ts`                                                                                                                                                                          |
| `api/protocols/*` (webviewProtocols, inboundHandlers)                                                                 | `webviewProtocols.test.ts`, `host/ghostPromptWebviewInboundHandlers.test.ts`, `shared/webviewMessageSchemas.test.ts`                                                                                                                                                                                                                            |
| `api/settings/*` (settingsPostMessage, applyWebviewUpdate)                                                            | `host/applyWebviewUpdateSetting.test.ts`, `MiniInputViewProvider.test.ts` (settings flow)                                                                                                                                                                                                                                                       |
| `api/getters/*` (workspaceGetters)                                                                                    | Indirecto via `MiniInputViewProvider.test.ts`, `host/ghostPromptSuggestPipeline.test.ts`                                                                                                                                                                                                                                                        |
| `core/` (types, `prompt/`, `presentation/`, `streaming/`, `language/`, `state/`, routing/sources, `memory/`, suggest) | `completionProvider.test.ts`, `completionSources.test.ts`, `CopilotCompletion.test.ts`, `opencodeLmCompletion.test.ts`, `completionInstruction.test.ts`, `instructionNormalizeContract.test.ts`, `suggestionLoadingUi.test.ts`, `projectBootstrapContext.test.ts`, `GhostPromptSessionStore.test.ts`, `host/ghostPromptSuggestPipeline.test.ts` |
| `engines/` (copilot, opencode, ollama, engineRegistry, **catalog/mergedModelCatalog**)                                | `engineRegistry.test.ts`, `ollamaLmEngine.test.ts`, `ollamaApiClient.test.ts`, `mergedModelCatalog.test.ts`, `opencodeApiClient.test.ts`, `opencodeLmCompletion.test.ts`, `opencodeModelCatalog.test.ts`, `opencodeModelTier.test.ts`, `normalizeOpencodeProviderModels.test.ts`                                                                |
| `destinations/` (copilotChat, vsOpenCodeX, destinationRegistry)                                                       | `destinationRegistry.test.ts`, `copilotChatDestination.test.ts`, `vsOpenCodeXDestination.test.ts`                                                                                                                                                                                                                                               |
| `core/suggest/` (runSuggest)                                                                                          | `host/ghostPromptSuggestPipeline.test.ts`, `MiniInputViewProvider.test.ts` (flujo suggest mock)                                                                                                                                                                                                                                                 |
| `core/memory/`                                                                                                        | `projectMemoryStore.test.ts`, `projectBootstrapContext.test.ts`, `bootstrapStoredHelpers.test.ts`, `entriesMutation.test.ts`, `editorIngestLru.test.ts`                                                                                                                                                                                         |
| `system/log/` (Logger, LogManager, transports)                                                                        | `system/log/levels.test.ts`, `system/log/breadcrumbs.test.ts`                                                                                                                                                                                                                                                                                   |
| `system/policies/` (`SuggestionRequestGovernor`, legacy)                                                              | `SuggestionRequestGovernor.test.ts`                                                                                                                                                                                                                                                                                                             |

Antes de una fase que **mueva** ficheros: ejecutar al menos los tests de las filas tocadas.

---

## Fases propuestas de refactor y comprobaciones previas

Orden recomendado; cada fase es **independiente** si la anterior está estable.

### Fase 0 — Baseline (sin mover código)

| Acción                                    | Criterio                          |
| ----------------------------------------- | --------------------------------- |
| Confirmar `npm run check` verde en `main` | CI local OK                       |
| Congelar este doc                         | Commit que añade `Docs/Owners.md` |

---

### Fase A — Documentación alineada con el código real

**Objetivo:** `Docs/ARCHITECTURE.md` y barrel `core/index.ts` describen multi-fuente, OpenCode y flujo suggest sin contradecir el código.

**Posibles cambios:** solo markdown y comentarios en barrels.

**Gate tests:** ninguno nuevo obligatorio; `npm run check` tras editar docs.

**Riesgo:** bajo.

**Estado:** **Hecho (2026-05-10)** — Overview y §2–8 de `ARCHITECTURE.md` actualizados; cabecera de `core/index.ts`; roadmap §8 enlaza Owners + OpenCode perf.

---

### Fase B — Partición de `completion/` (catálogo vs LM vs contexto proyecto)

**Objetivo:** carpetas o submódulos más claros (p. ej. `completion/catalog/`, `completion/providers/`, contexto bootstrap aparte).

**Gate tests (antes de mover imports):**

| Comportamiento                    | Tests que deben cubrir                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Registro y routing de proveedores | `completionProvider.test.ts`, `completionSources.test.ts`                                              |
| Copilot LM                        | `CopilotCompletion.test.ts`                                                                            |
| OpenCode LM + cola + snapshot     | `opencodeLmCompletion.test.ts`, `opencodeProvidersSnapshot*.test.ts`                                   |
| Catálogo OpenCode / merge / tiers | `opencodeModelCatalog.test.ts`, `normalizeOpencodeProviderModels.test.ts`, `opencodeModelTier.test.ts` |
| Bootstrap líneas para prompt      | `projectBootstrapContext.test.ts`                                                                      |

Si falta un caso (p. ej. export público solo usado desde host), **añadir test** antes del move.

**Riesgo:** medio (muchas rutas de import).

**Estado:** **Hecho (2026-05-10)** — `completion/catalog/` (model + OpenCode merge/tier/normalize), `completion/context/projectBootstrapContext.ts`; barrel y `projectMemory` actualizados; tests con rutas nuevas.

---

### Fase C — Orquestación de `suggest` (extraer pipeline desde `handleGhostPromptSuggest`)

**Objetivo:** clase o módulo `SuggestOrchestrator` / similar con deps explícitas; `handleGhostPromptSuggest` como thin wrapper.

**Gate tests (antes de extraer):**

| Comportamiento                   | Tests                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Loading + suggestion + broadcast | `MiniInputViewProvider.test.ts` (flujo suggest mock)                                     |
| Gobernador bloquea / cache       | `SuggestionRequestGovernor.test.ts`; escenarios suggest que pasen por governor si aplica |
| Mensajes y deps del handler      | `ghostPromptWebviewInboundHandlers.test.ts`                                              |

**Estado:** **Hecho (2026-05-10)** — `ghostPromptSuggestPipeline.ts` orquesta el mensaje `suggest` con `GhostPromptSuggestDeps`; `handleGhostPromptSuggest.ts` reexporta `runGhostPromptSuggestPipeline`; tests en `tests/host/ghostPromptSuggestPipeline.test.ts`.

**Riesgo:** medio-alto (mitigado por wrapper estable y tests unitarios del pipeline).

---

### Fase D — ESLint ampliado (opcional)

**Objetivo:** zonas extra (p. ej. `projectMemory` → no `host`; `system/debug` → no `host`) una regla cada vez.

**Gate:** `npm run lint` tras cada zona nueva; corregir imports reales o documentar excepción en la tabla § ESLint.

**Riesgo:** bajo si es incremental.

**Estado:** **Hecho (2026-05-10)** — Añadidas zonas `projectMemory` y `system/debug` → no `host`; sin violaciones en `src/` al activarlas.

---

### Fase E — Reorganización `core/` + `system/` (v0.5.2)

**Objetivo:** consolidar carpetas sueltas de 1 archivo en dos dominios canónicos.

**Estado:** **Hecho (2026-05-13)** — `core/` (13 archivos) + `system/` (5 archivos). 7 carpetas eliminadas. 226 tests passing. `npm run check` verde.

---

### Fase F — Desmantelar `host/` → `api/` + `vscode/` + `core/pipeline/` (v0.5.3)

**Objetivo:** separar las 4 responsabilidades mezcladas en `host/` en dominios canónicos con nombres auto-explicativos.

**Estado:** **Hecho (2026-05-13)** — `api/` (6 archivos + barrel), `vscode/` (3 archivos + barrel), `core/pipeline/` (2 archivos). `host/` eliminada. 226 tests passing. `npm run check` verde.

---

## Referencias

- **Roadmap v0.6 (reorganización dominio core / system / engines / destinations):** [`Docs/Plans/Roadmaps/v0.6/`](./Plans/Roadmaps/v0.6/README.md)
- Roadmap modularidad host: [`Docs/Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md`](./Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md)
- Arquitectura general: [`Docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- Roadmap v0.5.2: [`Docs/Plans/Roadmaps/Roadmap-v0.5.2-core-system-reorg.md`](./Plans/Roadmaps/Roadmap-v0.5.2-core-system-reorg.md)

---

## Bitácora

| Fecha      | Nota                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-10 | Creación del doc: matriz de ownership, mapa tests↔src, fases A–D y proceso previo a cada fase.                                                                                                                                                                                                                                        |
| 2026-05-10 | **Fase A:** `ARCHITECTURE.md` alineado con multi-fuente, OpenCode, protocolo Zod, IDs `ghostPrompt.*`; `completion/index.ts` comentario de barrel.                                                                                                                                                                                    |
| 2026-05-10 | **Fase B:** partición `completion/catalog/` + `completion/context/`; sin cambio de comportamiento; gate tests verde.                                                                                                                                                                                                                  |
| 2026-05-10 | **Fase C:** pipeline `ghostPromptSuggestPipeline.ts` + wrapper `handleGhostPromptSuggest.ts`; `ghostPromptSuggestPipeline.test.ts`; `npm run check` verde.                                                                                                                                                                            |
| 2026-05-10 | **Fase D:** ESLint `import/no-restricted-paths` para `projectMemory` y `debug` → no importar `host`; `npm run lint` verde.                                                                                                                                                                                                            |
| 2026-05-10 | Roadmap **v0.4.2 Fase 1:** auditoría `instruction` ↔ `normalize`; contrato documentado + `instructionNormalizeContract.test.ts`.                                                                                                                                                                                                      |
| 2026-05-10 | Roadmap **v0.4.2 Fase 2:** sin `prompt-tsx`; Copilot `sendRequest` con 2 mensajes `User`; `buildCompletionInstructionParts`.                                                                                                                                                                                                          |
| 2026-05-10 | Roadmap **v0.4.2 Fase 3:** roles `completion/catalog/*` documentados en `ARCHITECTURE.md` §3; sin cambio de código.                                                                                                                                                                                                                   |
| 2026-05-10 | Roadmap **v0.4.2 Fase 4:** audit OpenCode inline (cola, sesión, snapshot, SSE); docs §3; sin bump `@opencode-ai/sdk`.                                                                                                                                                                                                                 |
| 2026-05-10 | Roadmap **`Roadmap-v0.4.3-quality-resilience.md`:** fases 1–5 (tests suggest, CI OpenCode opcional, errores UX, tipos SDK, dual webview).                                                                                                                                                                                             |
| 2026-05-10 | Roadmap **v0.4.3 Fase 1:** matriz tests `ghostPromptSuggestPipeline` (`contextMode`, OpenCode, empty/error).                                                                                                                                                                                                                          |
| 2026-05-10 | Roadmap **v0.4.3 Fase 2:** releasing OpenCode + GitHub Actions (`ci.yml`, integración manual).                                                                                                                                                                                                                                        |
| 2026-05-13 | **v0.5.1 Ollama:** `src/engines/` como carpeta canónica de motores (copilot, opencode, ollama). `ollamaApiClient`, `ollamaLmEngine`, `ollamaModelCatalog`. Tests: +35, total 230. Docs actualizados.                                                                                                                                  |
| 2026-05-13 | **v0.5.1 Destinations refactor:** nueva carpeta `src/destinations/` con `copilotChat/` (→ `ChatBridge`), `vsOpenCodeX/` (→ `vsOpenCodeXGhostPromptUiBridge` + `notifyVsx`), `destinationRegistry.ts` con interfaz `DestinationProvider`. `vsOpenCodeXBridge.ts` → `engines/opencode/vsOpenCodeXConnection.ts`. Tests: +15, total 245. |
| 2026-05-13 | **v0.5.2 Core/system reorg:** `core/` (13 archivos) + `system/` (5 archivos). 7 carpetas eliminadas (`completion/`, `governor/`, `session/`, `debug/`, `log/`, `shared/`, `build/`). Todos los imports actualizados en `src/`, `tests/`, `webview/`. 226 tests passing. Docs actualizados.                                            |
| 2026-05-13 | **v0.5.3 Host refactor:** `host/` desmantelado → `api/` (6 archivos), `vscode/` (3 archivos), `core/pipeline/` (2 archivos). ESLint rules actualizadas (`projectMemory`, `system/debug` → no `api/`, `vscode/`). Mapa de tests actualizado. 226 tests passing. Docs actualizados.                                                     |
| 2026-05-13 | **v0.5.3 Memory reorg:** `projectMemory/` → `core/memory/` con subcarpetas (`io/`, `entries/`, `ingest/`, `probes/`). ESLint rules actualizadas (`core/memory/` → no `api/`, `vscode/`). Matriz de ownership y mapa de tests actualizados. 226 tests passing.                                                                         |
| 2026-05-14 | **v0.6 (inicio):** documentación alineada con taxonomía core/system/engines/destinations/api; `listMergedSuggestionModels` movido a `src/engines/catalog/mergedModelCatalog.ts`; barrel `core/index.ts` sin reexport merged. Ver [`v0.6/01-core-domain-reorganization.md`](./Plans/Roadmaps/v0.6/01-core-domain-reorganization.md).   |
