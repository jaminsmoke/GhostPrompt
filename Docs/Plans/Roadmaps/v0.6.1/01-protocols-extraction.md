# Roadmap v0.6.1 — Extracción de protocolos hacia `system/internals/protocols/`

> **Objetivo:** Poblar `system/internals/protocols/` como fuente única de contratos puros (tipos, constantes, validaciones, guards) extrayendo definiciones duplicadas o mal ubicadas en `sugcore/`, `destinations/`, webview y `api/`.
> **Contexto:** La v0.6 creó la carpeta `protocols/` con su estructura de familias (`constants/`, `types/`, `validations/`, `guards/`, `state/`). La v0.6.1 extrae los candidatos de alta prioridad identificados en el análisis: `SuggestionStyle`, destination types/constants, schemas duplicados del webview y tipos redundantes en `ui/webview/react/types.ts`.
> **Convención de nombres de archivo:** [`Docs/ExtensionArchitecture/NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md) (`cons*`, `type*`, `guard*`, `state*`, `zschem*`, stems cortos sin `ghostPrompt` redundante).
> **Fecha de creación:** 2026-05-16

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Revisión post-PA…PD (hallazgos para siguientes fases)

| Área | Estado actual | ¿Mover a `protocols/`? | Fase |
|------|---------------|--------------------------|------|
| Schemas Zod host↔webview | Canónico en `validations/schemas/zschemWebviewMessages.ts` | Ya está | — |
| `ui/webview/react/validators/parseWebviewInbound.ts` | Wrapper `parseWebviewInboundMessage` (importa `zschem*`) | Hecho (PF) | — |
| `ui/webview/react/types.ts` | Aliases + `GhostPromptCapabilities` / `Window` (webview-only) | Capabilities quedan en webview | — |
| `api/protocols/webviewProtocols.ts` | Parsers con logging (boundary host) | Correcto en `api/` | — |
| `api/protocols/inboundHandlers.ts` | Tipos DI de orquestación (`GhostPromptInbound*Services`) | No son wire protocol | — |
| Destinos agente | `consDestinations` + `typeDestinations` | Hecho (PB + PE) | — |
| Constantes Cursor Chat | `protocols/constants/consCursorChat.ts` | Hecho (PH); funciones con `vscode` en `destinations/cursor/cursorChatCommands.ts` | — |
| `CompletionUiKind` | `protocols/types/typeCompletionUi.ts` + `COMPLETION_UI_*_VALUES` en Zod | Hecho (PI) | — |
| `isProviderId` | `protocols/guards/guardProviderId.ts` | Hecho (PJ) | — |
| `CompletionCancellationToken` | `typeCompletion.ts` (sin `vscode`) | Hecho (PK) | — |
| `sugcore/sugstyle/styleLengthController.ts` | Eliminado (sin consumidores) | Hecho (PL) | — |
| Contratos log (`LogLevel`, límites, guards) | `consLogLimits`, `typeLog`, `guardLogLevel` | Hecho (QA) | Ver [`02-protocols-extraction-log.md`](./02-protocols-extraction-log.md) |
| Guards routing `looksLike*ModelId` | `protocols/guards/guardModelRouting.ts` | Hecho (QB) | Ver [`02-protocols-extraction-log.md`](./02-protocols-extraction-log.md) |
| `buildCompletionInstruction` | `engines/completion/` | Hecho (QD) | `sugcore/` eliminado |
| Validadores HTTP Ollama | `engines/provider/ollama/http/ollamaValidators.ts` | Contrato API externa Ollama, no wire GhostPrompt | Fuera de alcance |
| Constantes pool OpenCode | `engines/provider/opencode/client/constants.ts` | Config motor, no protocolo extensión | Fuera de alcance |
| Símbolos `GHOST_PROMPT_*`, `parseGhostPrompt*` | Renombrados (ver mapa PG en NamingConventions) | Hecho (PG) | — |

---

## Fases

### PA — `SuggestionStyle` → `protocols/types/`

> **Motivo:** `SuggestionStyle` ('concise' | 'balanced' | 'detailed') es un type puro usado por `protocols/types/completion.ts`, `system/runtime/suggestRuntime.ts`, `api/settings/settingsPostMessage.ts` y `api/getters/workspaceGetters.ts`. Hoy vive en `sugcore/sugstyle/`, fuera de la capa de contratos.

#### PA.1 — Crear archivo destino
- [x] Crear `src/system/internals/protocols/types/suggestionStyle.ts` con `export type SuggestionStyle`
- [x] Agregar `export * from './suggestionStyle'` al barrel `protocols/types/index.ts`

**Criterio de hecho:** El type existe en `protocols/types/suggestionStyle.ts` y se exporta desde el barrel.

#### PA.2 — Migrar import en `protocols/types/completion.ts`
- [x] Cambiar import desde `sugcore/` a `./suggestionStyle`

**Criterio de hecho:** `completion.ts` importa localmente desde `./suggestionStyle`, no desde `sugcore/`.

#### PA.3 — Migrar imports en consumidores externos
- [x] `src/api/getters/workspaceGetters.ts`
- [x] `src/system/runtime/suggestRuntime.ts`
- [x] `src/api/settings/settingsPostMessage.ts`

**Criterio de hecho:** 0 imports apuntan a `sugcore/sugstyle/styleLengthController` para `SuggestionStyle`.

#### PA.4 — Limpiar origen
- [x] `sugcore/sugstyle/styleLengthController.ts` convertido en re-export desde protocols

**Criterio de hecho:** El archivo origen no define el type directamente, solo re-exporta.

#### PA.5 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — 281 tests, 57 files, todos pasan

---

### PB — Destination types/constants → `protocols/`

> **Motivo:** `DestinationId`, `DestinationProvider`, `GhostPromptAgentDestination`, `GHOST_PROMPT_AGENT_DESTINATION_IDS`, `VS_OPEN_CODE_X_EXTENSION_ID`, `CURSOR_CHAT_DESTINATION_ID` y `parseGhostPromptAgentDestination` son contratos puros (sin imports de VS Code) que hoy viven en `destinations/`. Deben migrar a `protocols/constants/` y `protocols/types/`.

#### PB.1 — Crear constantes destino
- [x] Crear `src/system/internals/protocols/constants/ghostPromptDestinations.ts`:
  - `CURSOR_CHAT_DESTINATION_ID`, `VS_OPEN_CODE_X_EXTENSION_ID`, `GHOST_PROMPT_AGENT_DESTINATION_IDS`
- [x] Agregar `export * from './ghostPromptDestinations'` al barrel `protocols/constants/index.ts`

**Criterio de hecho:** Las constantes existen en `protocols/constants/` y se exportan desde el barrel.

#### PB.2 — Crear tipos destino
- [x] Crear `src/system/internals/protocols/types/destination.ts`:
  - `DestinationId`, `GhostPromptAgentDestination`, `DestinationProvider`, `parseGhostPromptAgentDestination`
- [x] Agregar `export * from './destination'` al barrel `protocols/types/index.ts`

**Criterio de hecho:** Types y función pura existen en `protocols/types/destination.ts`.

#### PB.3 — Actualizar `destinations/destinationRegistry.ts`
- [x] Importar constantes y types desde protocols
- [x] Eliminar definiciones locales (types, interfaces, función `parseGhostPromptAgentDestination`)

**Criterio de hecho:** `destinationRegistry.ts` importa todos los símbolos desde protocols; no los define localmente.

#### PB.4 — Actualizar `destinations/cursor/cursorHost.ts`
- [x] Importar `CURSOR_CHAT_DESTINATION_ID` desde protocols
- [x] Eliminar definición local

**Criterio de hecho:** `cursorHost.ts` importa la constante desde protocols; no la define localmente.

#### PB.5 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — 281 tests, 57 files, todos pasan

---

### PC — Deduplicación schemas webview (host→webview)

> **Motivo:** `ui/webview/react/validators/webviewMessageSchemas.ts` redefine schemas Zod (`providerStateRecordSchema`, `suggestionModelDescriptorSchema`, `webviewSettingsPayloadSchema`, `webviewInboundMessageSchema`) que ya existen en `protocols/validations/schemas/webviewMessageSchemas.ts`. La duplicación fuerza a mantener ambos sincronizados manualmente.

#### PC.1 — Exportar schemas faltantes desde el canónico
- [x] Exportar `providerStateRecordSchema` desde `protocols/validations/schemas/webviewMessageSchemas.ts`
- [x] Agregar `export type WebviewUpdateSetting = z.infer<typeof webviewUpdateSettingSchema>` en el mismo archivo

**Criterio de hecho:** El canónico exporta `providerStateRecordSchema` y `WebviewUpdateSetting`.

#### PC.2 — Actualizar webview validators
- [x] `ui/webview/react/validators/webviewMessageSchemas.ts`: importa `webviewOutboundMessageSchema` del canónico; elimina 7 schemas duplicados (~85 líneas)
- [x] Mantener `parseWebviewInboundMessage` como wrapper

**Criterio de hecho:** 0 schemas Zod definidos localmente en el webview; todos se importan del canónico. Reducción de 101 → 25 líneas.

#### PC.3 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — 281 tests, 57 files, todos pasan
- [x] `npm run build:webview` — exitoso (322 kB)

---

### PD — Tipos webview redundantes → importar desde protocols

> **Motivo:** `ui/webview/react/types.ts` redefine tipos que ya existen en protocols: `InboundMessage` (= `WebviewOutboundMessage`), `OutboundMessage` (= `WebviewInboundMessage`), `SettingsPayload` (= `WebviewSettingsPayload`), `SuggestionModel` (= `SuggestionModelDescriptor`), `AgentDestination` (= `DestinationId`), `CompletionProvider` (= `ProviderId`). Esto obliga a mantener definiciones paralelas.

#### PD.1 — Reemplazar definiciones por imports en `ui/webview/react/types.ts`
- [x] `InboundMessage` → alias de `WebviewOutboundMessage` (canónico)
- [x] `OutboundMessage` → alias de `WebviewInboundMessage` (canónico)
- [x] `SettingsPayload` → alias de `WebviewSettingsPayload` (canónico)
- [x] `SuggestionModel` → alias de `SuggestionModelDescriptor` (protocols/types)
- [x] `AgentDestination` → alias de `DestinationId` (protocols/types/destination)
- [x] `CompletionProvider` → alias de `ProviderId` (protocols/state/provider)
- [x] `UpdateSettingMessage` → alias de `WebviewUpdateSetting` (canónico)
- [x] Mantener `GhostPromptCapabilities`, Window augmentation, `LogLevel` (webview-specific)

**Criterio de hecho:** types.ts pasó de 153 → 33 líneas. 0 definiciones de tipo de protocolo locales; todo son imports/alias.

#### PD.2 — Actualizar consumidores
- [x] `hooks/useGhostPrompt.ts`: cast en `ghostPromptApplyInboundCaptureRef` por diferencia de `captureId`/`broadcast` en variants `settings`/`providerStatus`
- [x] `components/GhostToolbar.tsx`, `utils/hostQuery.ts`, tests: sin cambios (importan de `../types`, que ahora re-exporta desde protocols)

**Criterio de hecho:** 0 imports rotos. 1 cast añadido por diferencia estructural del canónico.

#### PD.3 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — 281 tests, 57 files, todos pasan
- [x] `npm run build:webview` — exitoso

---

### PE — Renaming físico en `protocols/` (prefijos + stems cortos)

> **Motivo:** Alinear nombres de archivo con [`NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md): prefijos por familia y dominio sin `ghostPrompt` repetido. Split `consOutboundForwardKinds` + `guardOutboundForward`; `boundSuggestionText` → `guardBoundSuggestion`.

#### PE.1 — Renombrar módulos y actualizar barrels/imports
- [x] `constants/`: `consDestinations`, `consPipelineDefaults`, `consOutboundForwardKinds`, `consVsOpenCodeX`
- [x] `types/`: `typeCompletion`, `typeDestinations`, `typeSuggestionStyle`, `typeOpencodeClient`; eliminar `types/params.ts` (reexport vía barrel → `consPipelineDefaults`)
- [x] `guards/`: `guardCopilotLm`, `guardBoundSuggestion`, `guardOutboundForward`
- [x] `state/`: `stateLoadingPhase`, `stateLoadingLabels`, `stateProviderId`, `stateProviderRecord`, `stateProviderModule`
- [x] `validations/schemas/`: `zschemWebviewMessages` (+ test)
- [x] Actualizar imports en `src/` y READMEs de `protocols/`, `api/`

#### PE.2 — Verificar regresión
- [x] `npm run check` — 281 tests, 57 files

**Criterio de hecho:** 0 referencias a rutas antiguas (`ghostPromptDestinations.ts`, `webviewMessageSchemas.ts` en `protocols/`, etc.) en `src/`.

---

### PF — Renombrar adaptador webview (nombre de archivo)

> **Motivo:** `ui/webview/react/validators/webviewMessageSchemas.ts` ya **no define** schemas Zod; solo reexporta/usa `parseWebviewInboundMessage` contra `zschemWebviewMessages`. El nombre induce a duplicar contratos o a editar el archivo equivocado.

#### PF.1 — Elegir nombre y renombrar
- [x] Renombrar a **`parseWebviewInbound.ts`** (alineado con la función pública `parseWebviewInboundMessage`)
- [x] **No** usar prefijo `zschem*` en webview (el canónico sigue en `protocols/validations/schemas/`)

#### PF.2 — Actualizar imports
- [x] `hooks/useGhostPrompt.ts`, `hooks/useGhostPrompt.test.ts`
- [x] Eliminar `validators/webviewMessageSchemas.ts`

#### PF.3 — Verificar regresión
- [x] `npm run check` + build webview

**Criterio de hecho:** 0 archivos bajo `validators/` con nombre `*MessageSchemas*` salvo documentación histórica.

---

### PG — Renombrado de símbolos exportados (PR dedicada)

> **Motivo:** Tras PE, los **archivos** ya siguen convención; los **exports** siguen con prefijos largos (`GHOST_PROMPT_*`, `parseGhostPromptAgentDestination`, `GhostPromptOutboundUiForwardKind`, …). Cambio transversal; conviene un PR solo de símbolos + imports.

#### PG.1 — Tabla de renombres acordada
- [x] Mapa viejo → nuevo en `NamingConventions.md` (sección PG)

#### PG.2 — Aplicar en `protocols/` y consumidores
- [x] `consDestinations`, `consOutboundForwardKinds`, `consVsOpenCodeX`, `typeDestinations`, `guardOutboundForward`
- [x] `destinationRegistry`, `vsOpenCodeXDestination`, `api/`, tests

#### PG.3 — Verificar regresión
- [x] `npm run check`

**Criterio de hecho:** 0 exports públicos con prefijo `GHOST_PROMPT_` en `src/` (env vars `GHOST_PROMPT_OPENCODE_*` fuera de alcance).

---

### PH — Constantes Cursor Chat → `protocols/constants/`

> **Motivo:** Literales de comandos Cursor (`CURSOR_CHAT_*`) son contrato puro (sin `vscode`). Viven en `consCursorChat.ts`; las funciones con `vscode` permanecen en `destinations/cursor/cursorChatCommands.ts` sin re-exportar constantes.

#### PH.1 — Crear `constants/consCursorChat.ts`
- [x] Mover constantes `as const` desde `cursorChatCommands.ts`
- [x] Barrel `constants/index.ts`

#### PH.2 — Actualizar `cursorChatCommands.ts` y consumidores
- [x] Importar desde `protocols/constants/consCursorChat` (sin re-export en destinations)
- [x] `cursorChatCommands.test.ts` importa constante desde protocols

#### PH.3 — Verificar regresión
- [x] `npm run check`

---

### PI — Tipo `CompletionUiKind` canónico

> **Motivo:** La unión `'copilot' | 'opencode' | 'ollama' | 'multi'` está duplicada en `zschemWebviewMessages` (enum Zod) y en el retorno de `getCompletionUiKind()` (`engines/config/completionSources.ts`).

#### PI.1 — Crear `types/typeCompletionUi.ts` (o ampliar `typeCompletion.ts`)
- [x] `CompletionUiKind`, `COMPLETION_UI_KIND_VALUES`, `COMPLETION_UI_SOURCE_VALUES`
- [x] Barrel `types/index.ts`

#### PI.2 — Usar lista compartida en Zod y engines
- [x] `zschemWebviewMessages.ts` — `completionUiSourceSchema` / `z.enum(COMPLETION_UI_KIND_VALUES)`
- [x] `getCompletionUiKind(): CompletionUiKind` en `completionSources.ts`
- [x] `typeCompletion.ts` — `completionSource?: ProviderId`
- [x] `GhostToolbar.tsx` — `COMPLETION_UI_SOURCE_VALUES` (sin literal local)

#### PI.3 — Verificar regresión
- [x] `npm run check`

---

### PJ — Guard `isProviderId` → `protocols/guards/`

> **Motivo:** Predicado puro sobre strings de configuración; hoy privado en `completionSources.ts`.

#### PJ.1 — Crear `guards/guardProviderId.ts` con `isProviderId`
- [x] `PROVIDER_ID_VALUES` en `stateProviderId.ts`; guard + test

#### PJ.2 — Usar en `normalizeCompletionSources` / `completionSources.ts`
- [x] Import desde `guardProviderId`; sin función privada duplicada

#### PJ.3 — Verificar regresión
- [x] `npm run check`

---

### PK — Desacoplar `vscode` de `typeCompletion.ts`

> **Motivo:** `CompletionRequestOptions` importa `CancellationToken` de `vscode`; los contratos en `protocols/` no deberían depender del host.

#### PK.1 — Definir tipo mínimo en protocols (p. ej. `{ isCancellationRequested: boolean }`) o usar `AbortSignal`
- [x] `CompletionCancellationToken` en `typeCompletion.ts`; `CompletionRequestOptions.token` sin import `vscode`
- [x] Engines compatibles por tipado estructural (`vscode.CancellationToken` en boundary)

#### PK.2 — Verificar regresión
- [x] `npm run check`

---

### PL — Eliminar shim `sugcore/sugstyle/styleLengthController.ts`

> **Motivo:** PA.4 dejó re-export por compatibilidad; los consumidores ya pueden importar `SuggestionStyle` desde `protocols/types`.

#### PL.1 — Buscar imports de `sugcore/sugstyle/styleLengthController`
- [x] 0 consumidores; canónico ya en `protocols/types/typeSuggestionStyle.ts`

#### PL.2 — Eliminar archivo o carpeta `sugstyle` si queda vacía
- [x] `styleLengthController.ts` eliminado; `sugcore/README.md` ya sin `sugstyle/`

#### PL.3 — Verificar regresión
- [x] `npm run check`

---

### PM — Barrido documentación y rastros legacy

> **Motivo:** Docs y tablas en roadmaps anteriores citan rutas pre-PE (`ghostPromptDestinations.ts`, `webviewMessageSchemas.ts` en protocols, `api/contracts/`, etc.).

#### PM.1 — Actualizar referencias en `Docs/` y READMEs de `src/`
- [x] `README.md`, `Docs/ARCHITECTURE.md`, `Docs/Owners.md`, `PhysicalStructure.md`, `src/system/README.md`
- [x] Sin carpeta `src/api/contracts/` ni `src/system/contracts/` en el árbol actual

#### PM.2 — Criterio de búsqueda
- [x] `src/`: 0 coincidencias de rutas pre-PE; roadmaps históricos en `Docs/Plans/` conservan contexto archivado

---

## Estado

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| PA | `SuggestionStyle` → `protocols/types/` | 🟢 Completado |
| PB | Destination types/constants → `protocols/` | 🟢 Completado |
| PC | Deduplicación schemas webview | 🟢 Completado |
| PD | Tipos webview redundantes → importar desde protocols | 🟢 Completado |
| PE | Renaming físico `protocols/` (prefijos) | 🟢 Completado |
| PF | Renombrar adaptador webview `validators/*` | 🟢 Completado |
| PG | Renombrado símbolos exportados | 🟢 Completado |
| PH | Constantes Cursor → `consCursorChat` | 🟢 Completado |
| PI | Tipo `CompletionUiKind` canónico | 🟢 Completado |
| PJ | Guard `isProviderId` | 🟢 Completado |
| PK | Desacoplar `vscode` en `typeCompletion` | 🟢 Completado |
| PL | Quitar shim `sugcore/sugstyle` | 🟢 Completado |
| PM | Docs y legacy sweep | 🟢 Completado |

---

## Notas

- **Orden sugerido (nuevo tramo):** PE (hecho) → **PF** (nombre webview, bajo riesgo) → **PH / PI / PJ** (extracciones pequeñas) → **PK** (más diseño) → **PG** (símbolos, PR dedicada) → **PL / PM** (limpieza).
- **PA → PD** se ejecutaron con nombres de archivo antiguos; **PE** actualiza rutas físicas; la bitácora PA–PD conserva nombres históricos a propósito.
- **PC y PD pueden fusionarse** en una sola ejecución si se hace en tándem, ya que ambas tocan el mismo conjunto de archivos webview.
- **Fuera de alcance v0.6.1:** schemas Zod de APIs HTTP de terceros (Ollama, OpenCode SDK wire) — permanecen bajo `engines/provider/*/http` o `client/`.

## Bitácora

| Fecha | Fase | Nota |
| ----- | ---- | ---- |
| 2026-05-16 | — | Roadmap creado tras el análisis de extracción de protocolos. Pendiente de inicio. |
| 2026-05-16 | PA | **PA completa:** `SuggestionStyle` movido a `protocols/types/suggestionStyle.ts`. 4 imports actualizados (completion.ts, workspaceGetters, suggestRuntime, settingsPostMessage). `styleLengthController.ts` queda como re-export. `npm run check` — 0 errores. 281 tests en verde (57 files). |
| 2026-05-16 | PB | **PB completa:** Creados `protocols/constants/ghostPromptDestinations.ts` y `protocols/types/destination.ts`. `destinationRegistry.ts` y `cursorHost.ts` importan desde protocols. Eliminadas 6 definiciones locales (constantes, types, interface, función). `npm run check` — 0 errores. 281 tests en verde (57 files). 90 módulos, 0 dependencias circulares. |
| 2026-05-16 | PC | **PC completa:** Exportados `providerStateRecordSchema` y `WebviewUpdateSetting` desde el canónico. Webview validators reducido de 101→25 líneas: importa `webviewOutboundMessageSchema` del canónico, elimina 7 schemas duplicados. `npm run check` — 0 errores. 281 tests en verde (57 files). Build webview OK (322 kB). |
| 2026-05-16 | PD | **PD completa:** `types.ts` reducido de 153→33 líneas. 7 tipos reemplazados por imports/alias desde protocols (InboundMessage, OutboundMessage, SettingsPayload, SuggestionModel, AgentDestination, CompletionProvider, UpdateSettingMessage). 1 cast añadido en `useGhostPrompt.ts` por diferencia estructural del canónico. `npm run check` — 0 errores. 281 tests en verde (57 files). |
| 2026-05-17 | — | Revisión post-PD: tabla de hallazgos; fases PE–PM planificadas. Convención de nombres en `Docs/ExtensionArchitecture/NamingConventions.md`. |
| 2026-05-17 | PE | **PE completa:** Renaming físico en `protocols/` (`cons*`, `type*`, `guard*`, `state*`, `zschem*`); split outbound cons/guard; `npm run check` — 281 tests. |
| 2026-05-17 | PF | **PF completa:** `validators/webviewMessageSchemas.ts` → `parseWebviewInbound.ts`; imports en `useGhostPrompt` (+ test). `npm run check` en verde. |
| 2026-05-17 | PH | **PH completa:** `consCursorChat.ts`; `cursorChatCommands.ts` solo funciones + import; test actualizado. |
| 2026-05-17 | PI | **PI completa:** `typeCompletionUi.ts`; Zod y `getCompletionUiKind` alineados; `GhostToolbar` sin literales duplicados. |
| 2026-05-17 | PL | **PL completa:** eliminado shim `sugcore/sugstyle/styleLengthController.ts` (solo re-export; 0 imports). |
| 2026-05-17 | PJ | **PJ completa:** `guardProviderId.ts` + `PROVIDER_ID_VALUES`; `completionSources.ts` importa guard. |
| 2026-05-17 | PG | **PG completa:** símbolos sin `GHOST_PROMPT_*` / `parseGhostPrompt*`; mapa en NamingConventions. |
| 2026-05-17 | PK | **PK completa:** `CompletionCancellationToken`; `typeCompletion.ts` sin `vscode`. |
| 2026-05-17 | PM | **PM completa:** docs vivos actualizados (`zschemWebviewMessages`, `parseWebviewInbound`, `getAgentDestination`); `src/` sin rutas legacy. |
