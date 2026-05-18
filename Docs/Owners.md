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
| -------------- | --- | ---------------------- | ---------------------- |
| **`ui/`** | Interfaz: `ui/webview/` (sandbox), `ui/provider/` (WebviewViewProvider), `ui/notifications/`. | `system/internals/protocols/`, `api/`, `system/runtime/`, `destinations/`, `engines/` (solo catálogo/routing expuesto), `vscode`. | Lógica pesada de orquestación suggest (vive en `system/runtime/`). |
| **`extension/`** | Entry point: comandos, vistas, `activate` / `deactivate`. | `ui/provider/`, `engines/` (registro motores), `destinations/`, `system/log/`, `vscode`. | Orquestación suggest, parsers Zod con logging (`api/protocols/`). |
| **`api/`** | Boundary host↔webview: protocolos Zod con logging, inbound handlers, settings, getters. | `system/internals/protocols/`, `system/runtime/`, `system/log/`, `engines/`, `destinations/`, `ui/provider/` (draft multi-vista), `vscode`. | — |
| **`engines/`** | Motores LM (`copilot/`, `opencode/`, `ollama/`), `completion/buildCompletionInstruction.ts`, `config/completionSources.ts`, `routing/`, `catalog/mergedModelCatalog.ts`. | `system/internals/protocols/`, `engines/completion/`, `system/log/`, `vscode`. | `api/` (evitar ciclos host). |
| **`destinations/`** | Destinos de prompt (copilotChat, cursor, vsOpenCodeX). `destinationRegistry.ts`. | `system/internals/protocols/` (tipos), `vscode`. | `api/`, `ui/`, `system/runtime/` (inyectar deps desde arriba). |
| **`system/internals/protocols/`** | Contratos puros: `cons*`, `type*`, `guard*`, `state*`, `zschem*` (sin `vscode`). | `zod` (solo en `validations/schemas/`). | `ui/`, `api/`, `engines/`, `destinations/`, `extension/`, `system/log/`, `system/runtime/`. Parsers con logging → `api/protocols/`. |
| **`system/internals/config/`** | Lectores tipados de `ghostPrompt.*` (p. ej. política de modelo). | `vscode`, `system/internals/protocols/`. | `ui/`, `api/` como capa de producto. |
| **`system/runtime/`** | Orquestación suggest, coordinator, estado de proveedores, finalize de completion. | `system/internals/protocols/`, `engines/`, `api/` (tipos DI), `system/log/`, `ui/provider/` (draft), `vscode`. | HTML/webview; duplicar contratos que ya están en `protocols/`. |
| **`system/log/`** | Logger, LogManager, transports, persistencia en disco. | `system/internals/protocols/` (tipos/guards), `vscode`, FS. | `ui/provider/`, `ui/notifications/`, `api/`. |
| **`system/build/`** | Verificación de empaquetado (webview bundle). | Node. | — |

**Notas de arquitectura (v0.6.1):**

- La carpeta **`core/`** y **`sugcore/`** ya no existen: dominio suggest → `system/runtime/`; prompt LM compartido → `engines/completion/`.
- **`buildCompletionInstruction`** no es protocolo wire; vive en `engines/completion/` (fase QD).

---

### ESLint (`import/no-restricted-paths`)

Reglas en `eslint/active-rules.js` → `import/no-restricted-paths` (nivel `error`):

| Objetivo (`target`) | No importar desde (`from`) |
| ------------------- | -------------------------- |
| **`src/system/internals/protocols/**/*`** | **`src/ui/**/*`**, **`src/api/**/*`**, **`src/engines/**/*`**, **`src/destinations/**/*`**, **`src/extension/**/*`**, **`src/system/log/**/*`**, **`src/system/runtime/**/*`** |
| **`src/system/log/**/*`** | **`src/ui/provider/**/*`**, **`src/ui/notifications/**/*`**, **`src/api/**/*`** | — |
| **`src/engines/**/*`** | **`src/api/**/*`** | — |

---

## Mapa de cobertura (tests ↔ `src/`)

No es cobertura de líneas al 100 %; es **contrato de tests que deben seguir pasando** cuando se toca cada zona.

| Área `src/` | Ficheros de test relevantes (Vitest) |
| ----------- | ------------------------------------ |
| `extension/extension.ts` | Indirecto: `ui/provider/MiniInputViewProvider.test.ts` |
| `ui/` (webview, provider, notifications) | `MiniInputViewProvider.test.ts`, `multiViewDraft.test.ts`, `webviewToolbarParity.test.ts`, `webviewThemeTokens.test.ts`, `ui/webview/react/App.test.tsx`, `ui/webview/react/hooks/useGhostPrompt.test.ts`, `ui/notifications/suggestionHostNotification.test.ts` |
| `api/protocols/*` | `api/protocols/webviewProtocols.test.ts`, `api/protocols/ghostPromptWebviewInboundHandlers.test.ts`, `system/internals/protocols/validations/schemas/zschemWebviewMessages.test.ts` |
| `api/settings/*` | `api/settings/applyWebviewUpdateSetting.test.ts`, `MiniInputViewProvider.test.ts` |
| `api/getters/*` | Indirecto vía `MiniInputViewProvider.test.ts`, `system/runtime/suggestRuntime.test.ts` |
| `system/internals/protocols/` | `guardModelRouting.test.ts`, `guardBoundSuggestion.test.ts`, `guardProviderId.test.ts`, `guardCopilotLm.test.ts`, `state/loading/stateLoadingLabels.test.ts`, `types/boundSuggestionText.test.ts`, `validations/schemas/zschemWebviewMessages.test.ts` |
| `system/internals/config/` | Indirecto vía runtime/UI que leen `ghostPrompt.suggestionModelPolicy` |
| `system/runtime/` | `suggestRuntime.test.ts`, `suggestionRequestCoordinator.test.ts`, `finalizeEngineCompletionResult.test.ts`, `providerStatusManager.test.ts`, `lastEffectiveSuggestionModel.test.ts`, `createProviderErrorRecord.test.ts` |
| `engines/completion/` | `engines/completion/buildCompletionInstruction.test.ts` |
| `engines/` (copilot, opencode, ollama, routing, catalog) | `resolveCompletionSource.test.ts`, `resolveProvider.test.ts`, `mergedModelCatalog.test.ts`, `copilotCompletionEngine.test.ts`, `collectLmResponse.test.ts`, `opencodeCompletionEngine.test.ts`, `opencodeClient.test.ts`, `ollamaApiClient.test.ts`, `routingModelId.test.ts`, tests de catálogo/tier/normalize por proveedor |
| `destinations/` | `destinationRegistry.test.ts`, `copilotChatDestination.test.ts`, `vsOpenCodeXDestination.test.ts`, `cursor/cursorChatCommands.test.ts`, `cursor/cursorHost.test.ts` |
| `system/log/` | `system/log/levels.test.ts` (importa `protocols/guards/guardLogLevel`), `Logger.test.ts`, `breadcrumbs.test.ts`, `outputChannelTransport.test.ts`, `outputChannelUsage.test.ts`, `logSubsystem.vscode.test.ts`, `legacyMarkdownMigration.vscode.test.ts` |
| `system/build/` | Indirecto vía `npm run check` / script de verificación bundle |

Antes de una fase que **mueva** ficheros: ejecutar al menos los tests de las filas tocadas.

---

## Fases propuestas de refactor y comprobaciones previas

Orden recomendado; cada fase es **independiente** si la anterior está estable.

### Fase 0 — Baseline (sin mover código)

| Acción | Criterio |
| ------ | -------- |
| Confirmar `npm run check` verde en `main` | CI local OK |
| Congelar este doc | Commit que añade `Docs/Owners.md` |

---

### Fase A — Documentación alineada con el código real

**Objetivo:** `Docs/ARCHITECTURE.md` y barrels describen multi-fuente, OpenCode y flujo suggest sin contradecir el código.

**Estado:** **Hecho (2026-05-10)**

---

### Fase B — Partición de `completion/` (catálogo vs LM)

**Estado:** **Hecho (2026-05-10)** — Evolucionó hacia `engines/` + `engines/completion/` (QD, 2026-05-18).

---

### Fase C — Orquestación de `suggest`

**Estado:** **Hecho (2026-05-10)** — Pipeline en `system/runtime/suggestRuntime.ts`; tests en `suggestRuntime.test.ts`.

---

### Fase D — ESLint ampliado (zonas de capas)

**Estado:** **Hecho (2026-05-10)** — Zonas `system/log` y `engines` → no `api/`.

**Ampliación v0.6.1 (2026-05-16):** Zona `protocols/` sustituye la zona obsoleta `sugcore/`; ver tabla § ESLint.

---

### Fases E–F — Reorg `core/` / `host/`

**Estado:** **Hecho (2026-05-13)** — `api/`, `system/runtime/`, sin `host/` ni `core/` en `src/`.

---

## Referencias

- Extracción de protocolos (bitácora): [`Docs/Plans/Roadmaps/v0.6.1/02-protocols-extraction-log.md`](./Plans/Roadmaps/v0.6.1/02-protocols-extraction-log.md)
- Roadmap v0.6: [`Docs/Plans/Roadmaps/v0.6/`](./Plans/Roadmaps/v0.6/README.md)
- Arquitectura general: [`Docs/ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Bitácora

| Fecha | Nota |
| ----- | ---- |
| 2026-05-10 | Creación del doc: matriz, mapa tests, fases A–D. |
| 2026-05-13 | Reorg v0.5.2–v0.5.3: `core/`, `host/`, `projectMemory/` → dominios actuales. |
| 2026-05-14 | Inicio v0.6: catálogo merged en `engines/catalog/`. |
| 2026-05-18 | QA–QD: contratos en `protocols/`; `buildCompletionInstruction` → `engines/completion/`; `sugcore/` eliminado. |
| 2026-05-16 | **Paso 2:** Matriz y mapa de tests alineados con `src/` actual; zona ESLint `protocols/` (reemplaza `sugcore/`). |
