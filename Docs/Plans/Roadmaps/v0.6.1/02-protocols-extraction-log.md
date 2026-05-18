# QA — Extracción de `system/log/` hacia `system/internals/protocols/`

> **Objetivo:** Mover los contratos puros del subsistema de logging (tipos, constantes, guards) desde `system/log/` a `system/internals/protocols/`, siguiendo las convenciones de naming y estructura establecidas en v0.6.1.
>
> **Contexto:** Contratos puros de logging canónicos en `protocols/` (`consLogLimits`, `typeLog`, `guardLogLevel`). QA.1–QA.6 extrajeron definiciones; QA.7 eliminó shims en `system/log/`.
>
> **Relacionado:** [`01-protocols-extraction.md`](./01-protocols-extraction.md) (PA–PM, cerrado). Este documento cubre el tramo **QA** (logging, cerrado) y el backlog **QB+**.
>
> **Convención de nombres:** [`Docs/ExtensionArchitecture/NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md) (`cons*`, `type*`, `guard*`).

> Estado general: ⚪ Pendiente | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Fases QA (logging)

### QA — Extracción `system/log/` → `protocols/`

> **Motivo:** `levels.ts`, `types.ts`, `emitContract.ts` y `logLimits.ts` eran 100% puros (sin `vscode`). Centralizar en `protocols/` evita duplicación con webview y alinea el subsistema log con la capa de contratos.

#### QA.1 — Crear archivos canónicos en `protocols/`

| Archivo destino en protocols | Contenido |
|------------------------------|-----------|
| `constants/consLogLimits.ts` | `LOG_LEGACY_MD_PREVIEW_MAX_CHARS`, `LOG_FILE_ROTATE_MAX_BYTES`, `LOG_OUTPUT_CHANNEL_RING_SIZE` |
| `types/typeLog.ts` | `LogLevelName`, `LogLevel` (lowercase alias), `Breadcrumb`, `LogEntry`, `LogTransport`, `EmitPayload`, `LogEmitSink` |
| `guards/guardLogLevel.ts` | `LOG_LEVEL_ORDER`, `parseLogLevelString()`, `levelIndex()`, `shouldEmit()` |

- [x] Crear los 3 archivos sin imports de `vscode`

**Criterio de hecho:** Los 3 archivos existen con sus exports, sin imports de `vscode`.

#### QA.2 — Agregar barrels en `protocols/`

- [x] `protocols/types/index.ts` → `export type * from './typeLog'`
- [x] `protocols/constants/index.ts` → `export * from './consLogLimits'`
- [x] `protocols/guards/index.ts` → `export * from './guardLogLevel'` (barrel nuevo)

**Criterio de hecho:** Los 3 barrels exportan los nuevos módulos.

#### QA.3 — Convertir orígenes en re-exports

- [x] `system/log/levels.ts` → re-exporta desde protocols
- [x] `system/log/types.ts` → re-exporta desde protocols
- [x] `system/log/emitContract.ts` → re-exporta desde protocols
- [x] `system/log/logLimits.ts` → re-exporta desde protocols

**Criterio de hecho:** Los consumidores que importan vía `system/log/` no se rompen.

#### QA.4 — Actualizar tests

- [x] `system/log/levels.test.ts` → importa de `protocols/guards/guardLogLevel`

**Criterio de hecho:** Tests del guard canónico apuntan a `protocols/`.

#### QA.5 — Unificar `LogLevel` duplicado en webview

- [x] `ui/webview/react/types.ts` → `export type { LogLevel }` desde `protocols/types/typeLog`

**Criterio de hecho:** 0 definiciones locales de `LogLevel` en webview.

#### QA.6 — Verificar regresión

- [x] `npm run check` — 0 errores

**Criterio de hecho:** Build, lint, typecheck y 285 tests en verde.

#### QA.7 — Quitar shims en `system/log/`

- [x] Eliminar `levels.ts`, `types.ts`, `emitContract.ts`, `logLimits.ts`
- [x] `Logger`, `LogManager`, `breadcrumbs`, `transports/*` importan desde `protocols/`
- [x] `system/log/index.ts` re-exporta contratos puros desde `protocols/` + API con side effects
- [x] Actualizar `protocols/README.md`

**Criterio de hecho:** Una sola definición por símbolo en `protocols/`; sin archivos shim intermedios.

---

## Estado QA

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| QA.1 | Crear archivos canónicos en `protocols/` | 🟢 Completado |
| QA.2 | Agregar barrels | 🟢 Completado |
| QA.3 | Convertir orígenes en re-exports | 🟢 Completado |
| QA.4 | Actualizar tests | 🟢 Completado |
| QA.5 | Unificar `LogLevel` en webview | 🟢 Completado |
| QA.6 | Verificar regresión (`npm run check`) | 🟢 Completado |
| QA.7 | Quitar shims `system/log/*.ts` | 🟢 Completado |

---

## Revisión post-QA (2026-05-18)

Verificación en código: canónicos `consLogLimits`, `typeLog`, `guardLogLevel`; sin shims en `system/log/`; webview importa `LogLevel` desde protocols; `levels.test.ts` en protocols. **`npm run check` en verde (285 tests).**

### Qué sigue sin mover (correcto que quede fuera)

| Área | ¿Mover a `protocols/`? | Motivo |
|------|--------------------------|--------|
| `Logger.ts`, `LogManager.ts`, `breadcrumbs.ts`, `transports/` | No | Side effects, `vscode`, estado mutable |
| `api/protocols/inboundHandlers.ts` (`GhostPromptInbound*Services`) | No | DI/orquestación host, no wire protocol |
| `engines/config/completionSources.ts` | No | Lee `vscode.workspace` |
| `engines/routing/resolveProvider.ts` (`EngineProvider`) | No | Adaptadores con implementación de motores |
| `system/runtime/createProviderErrorRecord.ts` | No | Factory con texto de UI; usa tipos ya en `protocols/state/` |
| `buildCompletionInstruction` | `engines/completion/` | Hecho (QD) | Prompt LM compartido; carpeta `sugcore/` eliminada |
| Validadores HTTP Ollama / constantes OpenCode client | No | Contrato API de terceros (igual que v0.6.1) |

---

## Fases QB+ (backlog)

> Criterio para abrir fase: símbolo **puro**, usado por **≥2 capas** (host, webview, engines, runtime, api), sin `vscode`. Orden sugerido por impacto / riesgo.

### QB — Guards de forma de `modelId` (enrutado)

> **Motivo:** `looksLikeOllamaModelId` y `looksLikeOpencodeModelId` viven bajo `engines/provider/*/routing/` pero las usa también `ui/provider/MiniInputViewProvider.ts` y `engines/routing/resolveCompletionSource.ts`. Son heurísticas de contrato compartidas, no implementación de motor.

#### QB.1 — Crear guard canónico en `protocols/`

- [x] Crear `protocols/guards/guardModelRouting.ts` con `looksLikeOllamaModelId` y `looksLikeOpencodeModelId`
- [x] Exportar desde `protocols/guards/index.ts`
- [x] Tests en `protocols/guards/guardModelRouting.test.ts`

**Criterio de hecho:** Funciones puras en `protocols/guards/` sin imports de `engines/` ni `vscode`.

#### QB.2 — Re-export temporal en engines

- [x] `engines/provider/ollama/routing/routingModelId.ts` → re-exporta `looksLikeOllamaModelId`
- [x] `engines/provider/opencode/routing/routingModelId.ts` → re-exporta `looksLikeOpencodeModelId`

**Criterio de hecho:** Rutas legacy siguen resolviendo durante la migración de imports.

#### QB.3 — Migrar consumidores

- [x] `engines/routing/resolveCompletionSource.ts`
- [x] `ui/provider/MiniInputViewProvider.ts`
- [x] Tests (`routingModelId.test.ts`, `resolveCompletionSource.test.ts`, mocks en `MiniInputViewProvider.test.ts`)

**Criterio de hecho:** 0 imports de `ui/` → `engines/provider/` solo por estos guards.

#### QB.4 — Verificar regresión

- [x] `npm run check` — 0 errores (287 tests)

**Criterio de hecho:** Build, lint, typecheck y 285 tests en verde.

---

### QC — Quitar shims de `system/log/` (limpieza)

> **Fusionado en QA.7** (2026-05-18). No abrir fase independiente.

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| QC | Eliminar shims `system/log/*.ts` | 🟢 Completado (vía QA.7) |

---

### QD — `buildCompletionInstruction` (ex `sugcore/rules/`)

> **Motivo:** Último resto de `sugcore/` era `rules/instruction.ts`. No es contrato wire host↔webview; es detalle de cómo los motores arman el prompt LM.

#### QD.1 — Decidir destino canónico

**Decisión:** **(b) `engines/completion/`** — compartido solo por motores (Copilot, OpenCode, Ollama); no pertenece a `protocols/`.

- [x] Registrar decisión en este doc

**Criterio de hecho:** Destino acordado por escrito (a / b / c).

#### QD.2 — Migrar símbolo al destino elegido

- [x] Crear `engines/completion/buildCompletionInstruction.ts` + tests + barrel
- [x] Actualizar imports en `copilot`, `ollama`, `opencode`
- [x] Eliminar `sugcore/rules/instruction.ts` y `sugcore/README.md` (carpeta vacía)

**Criterio de hecho:** 0 imports de `sugcore/` en `src/`.

#### QD.3 — Verificar regresión

- [x] `npm run check` — 0 errores

**Criterio de hecho:** Build, lint, typecheck y tests en verde.

---

## Estado QB+

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| QB.1 | Crear `guardModelRouting` en `protocols/` | 🟢 Completado |
| QB.2 | Re-export temporal en `engines/provider/*/routing/` | 🟢 Completado |
| QB.3 | Migrar consumidores (routing, ui, tests) | 🟢 Completado |
| QB.4 | Verificar regresión (`npm run check`) | 🟢 Completado |
| QC | Shims `system/log/` (limpieza) | 🟢 Completado (QA.7) |
| QD.1 | Decidir destino de `buildCompletionInstruction` | 🟢 Completado (opción b) |
| QD.2 | Migrar símbolo a `engines/completion/` | 🟢 Completado |
| QD.3 | Verificar regresión (`npm run check`) | 🟢 Completado |

---

## Fases QE+ (post-QD — gobernanza y limpieza)

> **Motivo:** Con QA–QD cerrados, el riesgo principal es **regresión de capas** (imports cruzados) y **rutas fantasma** en índices de búsqueda o docs. QE prioriza ESLint + inventario; QF es opcional (mover test de paridad).

### Inventario de candidatos (2026-05-16)

| Símbolo / área | Destino canónico | ¿Mover a `protocols/`? | Prioridad |
| -------------- | ---------------- | ------------------------ | --------- |
| `GhostPromptInbound*Services`, `GhostPromptSuggestDeps` | `api/protocols/`, `system/runtime/` | No — DI/orquestación host | — |
| `EngineProvider`, `resolveProvider` | `engines/routing/` | No — adaptadores con motores | — |
| `readGhostPromptSuggestionModelPolicy` | `system/internals/config/` | No — usa `vscode` | — |
| Validadores HTTP Ollama / constantes client OpenCode | `engines/provider/*/http/` | No — contrato API terceros | — |
| `filterCursorChatCandidateCommands` | `destinations/cursor/` | No — solo capa destinations | Baja |
| `buildCompletionInstruction` | `engines/completion/` | No (QD) | — |
| Archivos legacy sin prefijo (`completion.ts`, `copilotLm.ts`, `loadingLabels.ts`, …) | Ya renombrados a `type*`, `guard*`, `state*` | Auditar y borrar si reaparecen en disco | Media (QE.2) |
| Zona ESLint `sugcore/` | Obsoleta | Sustituir por zona `protocols/` | Alta (QE.1) |

**Verificación en disco (2026-05-16):** en `protocols/types/`, `protocols/guards/` y `protocols/state/loading/` solo existen nombres canónicos (`typeCompletion.ts`, `guardCopilotLm.ts`, `stateLoadingLabels.ts`, …). No hay shims legacy que importar.

---

### QE — Zona ESLint `protocols/` (pureza de capa)

#### QE.1 — Activar zona en `eslint/active-rules.js`

- [x] Sustituir target `./src/sugcore/**/*` por `./src/system/internals/protocols/**/*`
- [x] Bloquear imports desde `ui/`, `api/`, `engines/`, `destinations/`, `extension/`, `system/log/`, `system/runtime/`
- [x] Paridad schema host ↔ canónico en `api/protocols/webviewProtocols.test.ts` (sin import `api/` desde `protocols/`)
- [x] Actualizar `Docs/Owners.md` (matriz + tabla ESLint)

**Criterio de hecho:** `npm run lint` sin violaciones en `src/system/internals/protocols/` (salvo el test exceptuado).

#### QE.2 — Auditoría de rutas fantasma

- [x] Búsqueda de imports a `sugcore/`, `core/` y nombres legacy en `protocols/` — 0 coincidencias en `src/`
- [x] Árbol `protocols/` en disco: solo prefijos canónicos (`type*`, `guard*`, `state*`, `cons*`, `zschem*`)
- [x] `src/sugcore/` ausente del árbol

**Criterio de hecho:** 0 referencias activas en `src/` a `sugcore/` o shims legacy en `protocols/`.

#### QE.3 — Verificar regresión

- [x] `npm run check` — 0 errores (287 tests)

**Criterio de hecho:** Build, lint, typecheck y tests en verde.

---

### QF — Test de paridad schema (cerrado vía QE.1)

> **Decisión (2026-05-16):** opción **A** — paridad `webviewInboundMessageSchema` en `api/protocols/webviewProtocols.test.ts`; `zschemWebviewMessages.test.ts` solo valida el canónico.

---

## Estado QE+

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| QE.1 | Zona ESLint `protocols/` + `Owners.md` | 🟢 Completado |
| QE.2 | Auditoría rutas fantasma / shims | 🟢 Completado |
| QE.3 | Verificar regresión (`npm run check`) | 🟢 Completado |
| QF.1 | Paridad schema host ↔ protocols | 🟢 Completado (opción A, vía QE.1) |

---

## Fuera de alcance explícito (no abrir fase)

- `no-ternary` / más tranches ESLint cosméticos → después de rutas canónicas estables (QE.3 en verde)
- `resolveCompletionSourceForRequest` → queda en `engines/routing/` (solo engines/runtime)
- Tipos DI (`GhostPromptSuggestDeps`, `GhostPromptInbound*Services`) → quedan en runtime / `api/protocols/`

---

## Notas

- `system/log/Logger.ts`, `LogManager.ts`, `breadcrumbs.ts` y `transports/` **no son protocolo** — tienen side effects y/o `vscode`; importan tipos desde `protocols/`.
- `LogLevel` (lowercase) vive como alias en `typeLog.ts` para alinear host y webview.
- El barrel `protocols/guards/index.ts` puede acumular más `guard*` (QB ampliará exports).

## Bitácora

| Fecha | Fase | Nota |
| ----- | ---- | ---- |
| 2026-05-18 | — | Plan creado. Pendiente de inicio. |
| 2026-05-18 | QA | **QA completa (QA.1–QA.6):** canónicos `consLogLimits`, `typeLog`, `guardLogLevel`; barrels; shims temporales; webview sin `LogLevel` local. `npm run check` — 285 tests. |
| 2026-05-18 | QA.7 | Shims eliminados; barrel e implementación apuntan a `protocols/`. `protocols/README.md` actualizado. |
| 2026-05-18 | — | Revisión post-QA: fases QB y QD desglosadas con tabla de estado; QC fusionada en QA.7. |
| 2026-05-18 | QB | **QB completa:** `guardModelRouting.ts`; re-exports en engines; `ui/` ya no importa `engines/provider` por guards. `npm run check` — 287 tests. |
| 2026-05-18 | QD | **QD completa:** `buildCompletionInstruction` → `engines/completion/`; `sugcore/` eliminado. Decisión (b). |
| 2026-05-16 | QE | **Paso 3:** inventario QE+ (tabla candidatos); fases QE.1–QE.3 y QF.1 en backlog. |
| 2026-05-16 | QE.1 | Zona ESLint `protocols/` activa; `Owners.md` alineado (sin `core/` ni `sugcore/`). |
| 2026-05-16 | QE.3 | `npm run check` verde (287 tests); paridad schema movida a `api/protocols/webviewProtocols.test.ts`. |
