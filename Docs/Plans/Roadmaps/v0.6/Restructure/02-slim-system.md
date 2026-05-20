# Roadmap v0.6 Restructure — Adelgazar `system/`

> **Objetivo:** Limpiar `system/runtime/` de lo que no es runtime puro, mover constantes de protocolo a `system/internals/protocols/`, y renombrar archivos para que el nombre refleje su función.
> **Contexto:** `sugcore/` ya está limpio y solo contiene dominio puro (rules, sugstyle). `system/` ahora debe recibir el mismo tratamiento quirúrgico: eliminar barrels innecesarios, mover constantes/parámetros a protocols, y revisar nombres.
> **Fecha de creación:** 2026-05-15

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Fases

### R21 — Eliminar barrel `system/runtime/index.ts`

> **Motivo:** El barrel solo re-exporta `GhostPromptSuggestDeps`, `runGhostPromptSuggestPipeline` y un alias `handleGhostPromptSuggest`. Los 3 consumidores pueden importar directamente desde `suggest.ts` (próximamente `suggestRuntime.ts`).

#### R21.1 — Actualizar 3 imports para que apunten directo a `suggest`
- [x] `src/api/protocols/inboundHandlers.ts` — `../../system/runtime` → `../../system/runtime/suggest`
- [x] `src/api/protocols/ghostPromptWebviewInboundHandlers.test.ts` — `../../system/runtime` → `../../system/runtime/suggest`
- [x] `src/ui/provider/MiniInputViewProvider.ts` — `../../system/runtime` → `../../system/runtime/suggest`

**Criterio de hecho:** 0 imports apuntan a `system/runtime` (el barrel).

#### R21.2 — Eliminar barrel
- [x] Eliminar `src/system/runtime/index.ts`

**Criterio de hecho:** El archivo no existe.

#### R21.3 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — todos pasan

---

### R22 — Renombrar `suggest.ts` → `suggestRuntime.ts` y mover `MIN_SUGGEST_INPUT_CHARS`

> **Motivo:** `suggest.ts` no sugiere nada — orquesta el runtime del pipeline. `suggestRuntime.ts` es más descriptivo. Además la constante `MIN_SUGGEST_INPUT_CHARS = 3` es un parámetro de protocolo, no de runtime.

#### R22.1 — Renombrar archivos
- [x] Renombrar `src/system/runtime/suggest.ts` → `src/system/runtime/suggestRuntime.ts`
- [x] Renombrar `src/system/runtime/suggest.test.ts` → `src/system/runtime/suggestRuntime.test.ts`

**Criterio de hecho:** Los archivos existen con el nuevo nombre.

#### R22.2 — Actualizar import dentro de `suggestRuntime.test.ts`
- [x] Cambiar `from './suggest'` → `from './suggestRuntime'`

**Criterio de hecho:** El test importa desde el nuevo nombre.

#### R22.3 — Actualizar imports en consumidores de `suggest`
- [x] `src/api/protocols/inboundHandlers.ts` — `../../system/runtime/suggest` → `../../system/runtime/suggestRuntime`
- [x] `src/api/protocols/ghostPromptWebviewInboundHandlers.test.ts` — `../../system/runtime/suggest` → `../../system/runtime/suggestRuntime`
- [x] `src/ui/provider/MiniInputViewProvider.ts` — `../../system/runtime/suggest` → `../../system/runtime/suggestRuntime`

**Criterio de hecho:** 0 imports apuntan a `system/runtime/suggest`.

#### R22.4 — Mover `MIN_SUGGEST_INPUT_CHARS` a `system/internals/protocols/params.ts`
- [x] Añadir `DEFAULT_MIN_SUGGEST_INPUT_CHARS = 3` a `src/system/internals/protocols/params.ts`
- [x] Actualizar import en `suggestRuntime.ts`: de constante local a `import { DEFAULT_MIN_SUGGEST_INPUT_CHARS } from '../internals/protocols/params'`

**Criterio de hecho:** La constante vive en `params.ts` con prefijo `DEFAULT_*`.

#### R22.5 — Verificar regresión
- [x] `npm run check` — 0 errores
- [x] `npm run test` — todos pasan

---

## Estado

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| R21 | Eliminar barrel `system/runtime/index.ts` | 🟢 Completado |
| R22 | Renombrar `suggest.ts` → `suggestRuntime.ts` y mover `MIN_SUGGEST_INPUT_CHARS` | 🟢 Completado |

---

## Bitácora

| Fecha | Fase | Nota |
| ----- | ---- | ---- |
| 2026-05-15 | — | Roadmap creado tras completar R1–R20 de `01-slim-core.md` |
| 2026-05-15 | R21 | **R21 completa:** Barrel `system/runtime/index.ts` eliminado. 3 imports actualizados (inboundHandlers, test, MiniInputViewProvider) + 1 dynamic import en test + 1 vi.mock. Añadido alias `handleGhostPromptSuggest` en `suggestRuntime.ts`. 283 tests en verde (54 files). |
| 2026-05-15 | R22 | **R22 completa:** `suggest.ts` → `suggestRuntime.ts` (test: `suggestRuntime.test.ts`). `MIN_SUGGEST_INPUT_CHARS` movido a `system/internals/protocols/params.ts` como `DEFAULT_MIN_SUGGEST_INPUT_CHARS`. 5 imports actualizados (3 consumidores + test + vi.mock). `npm run check` — 0 errores. 283 tests en verde (54 files). `build:webview` exitoso. |
