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

| Carpeta `src/` | Rol | Depende típicamente de | No debe importar desde |
| ---------------- | ----- | -------------------------- | ------------------------- |
| **`extension/`** | Punto de entrada; registra comandos y vistas; lifecycle `activate` / `deactivate`. | `host`, `projectMemory` (activate), `opencode` (sync runtime), `debug`. | Evitar lógica de negocio pesada aquí (mantener delgado). |
| **`host/`** | Webview provider, mensajes inbound/outbound, HTML/CSP, wire de suggest → completion. | `completion`, `session`, `projectMemory`, `opencode` (warm), `shared`, `debug`. | No meter aquí runtime OpenCode embebido largo (delegar a `opencode/`). |
| **`completion/`** | Motores LM en `engines/`, núcleo en raíz (`types`, instrucción, fuentes), **`catalog/`** (modelos Copilot/OpenCode/Ollama, merge, tiers), **`context/`** (bootstrap README/package para prompts). | `engines/`, `vscode`. | No UI webview ni HTML. |
| **`engines/`** | Motores de completion canónicos. `copilot/copilotLmEngine`, `opencode/opencodeLmEngine`, `ollama/ollamaLmEngine`, `ollama/ollamaApiClient`, `engineRegistry.ts`. | `completion` (types, instruction, normalize), `vscode`. | No importar desde `host/`. |
| **`opencode/`** | Proceso embebido, SDK, SSE, caché providers, sesión inline, cola LM, CLI. | `debug` (logs perf), Node. | **`host/`** — prohibido por ESLint (ver abajo). |
| **`session/`** | Estado compartido Sidebar/Panel (`GhostPromptSessionStore`). | `vscode`, tipos desde `completion` si hace falta. | Evitar acoplar a un solo handler del webview. |
| **`governor/`** | Gobernador de peticiones (cache, cooldown, rate limit). | Tipos/config; sin LM directo. | `host/`. |
| **`projectMemory/`** | Store JSON, reconcile, ingest, watchers. | `vscode`, FS propio. | `host/` (riesgo de cycle conceptual; pasar datos desde host como deps). |
| **`debug/`** | Canal de salida y toggles de debug. | `vscode`. | `host/` (opcional endurecer en ESLint más adelante). |
| **`destinations/`** | Destinos de prompt (copilotChat, vsOpenCodeX). Registro `DestinationProvider` en `destinationRegistry.ts`. | `vscode`, `engines/opencode` (VS_OPEN_CODE_X_EXTENSION_ID). | No importar desde `host/` (delegar a `destinationRegistry`). |
| **`log/`** | Persistencia conversación / suggestions en disco. | `vscode`, FS. | — |
| **`shared/`** | Schemas/tipos compartidos host ↔ contratos (Zod). | `zod`. | `host/` en runtime del webview bundle (el cliente es otro build). |
| **`build/`** | Scripts de verificación empaquetado (ej. webview bundle). | Node. | — |

### ESLint (`import/no-restricted-paths`)

Reglas en `.eslintrc.json` (nivel `warn`):

| Objetivo (`target`) | No importar desde (`from`) |
| --------------------- | ---------------------------- |
| **`src/opencode/**/*`** | **`src/host/**/*`** |
| **`src/projectMemory/**/*`** | **`src/host/**/*`** |
| **`src/debug/**/*`** | **`src/host/**/*`** |

Sin excepciones documentadas en la fecha de la [bitácora](#bitácora) (Fase D).

---

## Mapa de cobertura (tests ↔ `src/`)

No es cobertura de líneas al 100 %; es **contrato de tests que deben seguir pasando** cuando se toca cada zona.

| Área `src/` | Ficheros de test relevantes (Vitest) |
| ------------- | -------------------------------------- |
| `extension/extension.ts` | Parcialmente indirecto: `MiniInputViewProvider.test.ts` (registro webview); integración opcional. |
| `host/*` (MiniInput, handlers, protocols, settings, suggest wiring) | `MiniInputViewProvider.test.ts`, `webviewProtocols.test.ts`, `host/ghostPromptWebviewInboundHandlers.test.ts`, `host/ghostPromptSuggestPipeline.test.ts`, `webviewToolbarParity.test.ts` (incl. paridad dual vista v0.4.3), `webviewThemeTokens.test.ts`, `shared/webviewMessageSchemas.test.ts`, `webview/composeLabels.test.ts`, `webview/userErrorMessage.test.ts` |
| `host/ghostPromptSuggestPipeline.ts` + `handleGhostPromptSuggest.ts` (wrapper) | `host/ghostPromptSuggestPipeline.test.ts` (deps mínimas + spy `getCompletionProviderForSource`); flujo integrado en `MiniInputViewProvider.test.ts`. |
| `completion/` (raíz: providers, sources, types; **`catalog/`**, **`context/`**) | `completionProvider.test.ts`, `completionSources.test.ts`, `CopilotCompletion.test.ts`, `opencodeLmCompletion.test.ts`, `completionInstruction.test.ts`, `instructionNormalizeContract.test.ts`, `normalizeOpencodeProviderModels.test.ts`, `opencodeModelTier.test.ts`, `opencodeModelCatalog.test.ts`, `suggestionLoadingUi.test.ts`, `projectBootstrapContext.test.ts`, `opencodeProvidersSnapshot.test.ts`, `opencodeProvidersSnapshot.perf.test.ts`, `logOpenCodePerfCapture.test.ts` |
| `engines/` (copilot, opencode, ollama, engineRegistry) | `engineRegistry.test.ts`, `ollamaLmEngine.test.ts`, `ollamaApiClient.test.ts`, `mergedModelCatalog.test.ts` |
| `destinations/` (copilotChat, vsOpenCodeX, destinationRegistry) | `destinationRegistry.test.ts`, `copilotChatDestination.test.ts`, `vsOpenCodeXDestination.test.ts` |
| `opencode/` (runtime, stream, cli, queue, session pool, puente VSOpenCodeX) | `opencodeLmCompletion.test.ts`, `opencodeProvidersSnapshot.test.ts`, `opencodeProvidersSnapshot.perf.test.ts`, `opencodeSuggestionStream.test.ts`, `openCodeCli.test.ts`, `nodeFetchDuplex.test.ts`, `vsOpenCodeXBridge.test.ts` (→ `engines/opencode/vsOpenCodeXConnection`), `opencodeSseDebug.test.ts`, `opencodeSuggestions.integration.test.ts` (opcional, env) |
| `session/` | `GhostPromptSessionStore.test.ts` |
| `governor/` | `SuggestionRequestGovernor.test.ts` |
| `projectMemory/` | `projectMemoryStore.test.ts`, `projectBootstrapContext.test.ts`, `bootstrapStoredHelpers.test.ts`, `entriesMutation.test.ts`, `editorIngestLru.test.ts` |

Antes de una fase que **mueva** ficheros: ejecutar al menos los tests de las filas tocadas.

---

## Fases propuestas de refactor y comprobaciones previas

Orden recomendado; cada fase es **independiente** si la anterior está estable.

### Fase 0 — Baseline (sin mover código)

| Acción | Criterio |
| -------- | ---------- |
| Confirmar `npm run check` verde en `main` | CI local OK |
| Congelar este doc | Commit que añade `Docs/Owners.md` |

---

### Fase A — Documentación alineada con el código real

**Objetivo:** `Docs/ARCHITECTURE.md` y barrel `completion/index.ts` describen multi-fuente, OpenCode y flujo suggest sin contradecir el código.

**Posibles cambios:** solo markdown y comentarios en barrels.

**Gate tests:** ninguno nuevo obligatorio; `npm run check` tras editar docs.

**Riesgo:** bajo.

**Estado:** **Hecho (2026-05-10)** — Overview y §2–8 de `ARCHITECTURE.md` actualizados; cabecera de `completion/index.ts`; roadmap §8 enlaza Owners + OpenCode perf.

---

### Fase B — Partición de `completion/` (catálogo vs LM vs contexto proyecto)

**Objetivo:** carpetas o submódulos más claros (p. ej. `completion/catalog/`, `completion/providers/`, contexto bootstrap aparte).

**Gate tests (antes de mover imports):**

| Comportamiento | Tests que deben cubrir |
| ---------------- | ------------------------- |
| Registro y routing de proveedores | `completionProvider.test.ts`, `completionSources.test.ts` |
| Copilot LM | `CopilotCompletion.test.ts` |
| OpenCode LM + cola + snapshot | `opencodeLmCompletion.test.ts`, `opencodeProvidersSnapshot*.test.ts` |
| Catálogo OpenCode / merge / tiers | `opencodeModelCatalog.test.ts`, `normalizeOpencodeProviderModels.test.ts`, `opencodeModelTier.test.ts` |
| Bootstrap líneas para prompt | `projectBootstrapContext.test.ts` |

Si falta un caso (p. ej. export público solo usado desde host), **añadir test** antes del move.

**Riesgo:** medio (muchas rutas de import).

**Estado:** **Hecho (2026-05-10)** — `completion/catalog/` (model + OpenCode merge/tier/normalize), `completion/context/projectBootstrapContext.ts`; barrel y `projectMemory` actualizados; tests con rutas nuevas.

---

### Fase C — Orquestación de `suggest` (extraer pipeline desde `handleGhostPromptSuggest`)

**Objetivo:** clase o módulo `SuggestOrchestrator` / similar con deps explícitas; `handleGhostPromptSuggest` como thin wrapper.

**Gate tests (antes de extraer):**

| Comportamiento | Tests |
| ---------------- | ------- |
| Loading + suggestion + broadcast | `MiniInputViewProvider.test.ts` (flujo suggest mock) |
| Gobernador bloquea / cache | `SuggestionRequestGovernor.test.ts`; escenarios suggest que pasen por governor si aplica |
| Mensajes y deps del handler | `ghostPromptWebviewInboundHandlers.test.ts` |

**Estado:** **Hecho (2026-05-10)** — `ghostPromptSuggestPipeline.ts` orquesta el mensaje `suggest` con `GhostPromptSuggestDeps`; `handleGhostPromptSuggest.ts` reexporta `runGhostPromptSuggestPipeline`; tests en `tests/host/ghostPromptSuggestPipeline.test.ts`.

**Riesgo:** medio-alto (mitigado por wrapper estable y tests unitarios del pipeline).

---

### Fase D — ESLint ampliado (opcional)

**Objetivo:** zonas extra (p. ej. `projectMemory` → no `host`; `debug` → no `host`) una regla cada vez.

**Gate:** `npm run lint` tras cada zona nueva; corregir imports reales o documentar excepción en la tabla § ESLint.

**Riesgo:** bajo si es incremental.

**Estado:** **Hecho (2026-05-10)** — Añadidas zonas `projectMemory` y `debug` → no `host`; sin violaciones en `src/` al activarlas.

---

## Referencias

- Roadmap modularidad host: [`Docs/Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md`](./Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md)
- Arquitectura general: [`Docs/ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Bitácora

| Fecha | Nota |
| ------- | ------ |
| 2026-05-10 | Creación del doc: matriz de ownership, mapa tests↔src, fases A–D y proceso previo a cada fase. |
| 2026-05-10 | **Fase A:** `ARCHITECTURE.md` alineado con multi-fuente, OpenCode, protocolo Zod, IDs `ghostPrompt.*`; `completion/index.ts` comentario de barrel. |
| 2026-05-10 | **Fase B:** partición `completion/catalog/` + `completion/context/`; sin cambio de comportamiento; gate tests verde. |
| 2026-05-10 | **Fase C:** pipeline `ghostPromptSuggestPipeline.ts` + wrapper `handleGhostPromptSuggest.ts`; `ghostPromptSuggestPipeline.test.ts`; `npm run check` verde. |
| 2026-05-10 | **Fase D:** ESLint `import/no-restricted-paths` para `projectMemory` y `debug` → no importar `host`; `npm run lint` verde. |
| 2026-05-10 | Roadmap **v0.4.2 Fase 1:** auditoría `instruction` ↔ `normalize`; contrato documentado + `instructionNormalizeContract.test.ts`. |
| 2026-05-10 | Roadmap **v0.4.2 Fase 2:** sin `prompt-tsx`; Copilot `sendRequest` con 2 mensajes `User`; `buildCompletionInstructionParts`. |
| 2026-05-10 | Roadmap **v0.4.2 Fase 3:** roles `completion/catalog/*` documentados en `ARCHITECTURE.md` §3; sin cambio de código. |
| 2026-05-10 | Roadmap **v0.4.2 Fase 4:** audit OpenCode inline (cola, sesión, snapshot, SSE); docs §3; sin bump `@opencode-ai/sdk`. |
| 2026-05-10 | Roadmap **`Roadmap-v0.4.3-quality-resilience.md`:** fases 1–5 (tests suggest, CI OpenCode opcional, errores UX, tipos SDK, dual webview). |
| 2026-05-10 | Roadmap **v0.4.3 Fase 1:** matriz tests `ghostPromptSuggestPipeline` (`contextMode`, OpenCode, empty/error). |
| 2026-05-10 | Roadmap **v0.4.3 Fase 2:** releasing OpenCode + GitHub Actions (`ci.yml`, integración manual). |
| 2026-05-13 | **v0.5.1 Ollama:** `src/engines/` como carpeta canónica de motores (copilot, opencode, ollama). `ollamaApiClient`, `ollamaLmEngine`, `ollamaModelCatalog`. Tests: +35, total 230. Docs actualizados. |
| 2026-05-13 | **v0.5.1 Destinations refactor:** nueva carpeta `src/destinations/` con `copilotChat/` (→ `ChatBridge`), `vsOpenCodeX/` (→ `vsOpenCodeXGhostPromptUiBridge` + `notifyVsx`), `destinationRegistry.ts` con interfaz `DestinationProvider`. `vsOpenCodeXBridge.ts` → `engines/opencode/vsOpenCodeXConnection.ts`. Tests: +15, total 245. |
