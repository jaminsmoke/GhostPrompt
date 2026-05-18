# RA–RF — Higiene de `system/internals/protocols/`

> **Objetivo:** Corregir la organización interna de `protocols/` para que cada archivo contenga solo lo que corresponde a su carpeta según [`NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md). Sin mover cosas fuera de `protocols/`, solo reubicando dentro de la misma capa.
>
> **Contexto:** La auditoría reveló que el layer es puro (sin `vscode`, sin I/O, sin side effects) pero tiene fugas semánticas: constantes runtime en archivos de tipos, funciones en archivos de tipos, y un barrel `guards/index.ts` incompleto.

---

## Fases

### RA — Barrel `guards/index.ts` completo

> **Motivo:** `guards/index.ts` solo exporta `guardLogLevel` y `guardModelRouting`. Faltan `guardBoundSuggestion`, `guardCopilotLm`, `guardOutboundForward`, `guardProviderId`. Cualquier import desde el barrel se pierde.

- [ ] Agregar los 4 `export *` faltantes en `guards/index.ts`

**Criterio de hecho:** `guards/index.ts` exporta los 6 módulos de guards. 0 imports rotos.

---

### RB — `parseAgentDestination()` → `guards/guardAgentDestination.ts`

> **Motivo:** `types/typeDestinations.ts` define tipos + la función `parseAgentDestination()`. Las funciones van en `guards/`.

- [ ] Crear `guards/guardAgentDestination.ts` con la función
- [ ] Eliminar la función de `types/typeDestinations.ts` (solo tipos)
- [ ] Agregar `export * from './guardAgentDestination'` en `guards/index.ts`
- [ ] Actualizar import en `destinations/destinationRegistry.ts`

**Criterio de hecho:** `typeDestinations.ts` tiene 0 funciones. `guardAgentDestination.ts` tiene la función. Barrel exporta todo.

---

### RC — Constantes runtime de `typeOpencodeClient` → `constants/consOpencodeClient.ts`

> **Motivo:** `types/typeOpencodeClient.ts` mezcla interfaces con 5 constantes numéricas.

- [ ] Crear `constants/consOpencodeClient.ts` con `OPENCODE_DEFAULT_PORT`, `OPENCODE_HEALTH_CHECK_TIMEOUT_MS`, `OPENCODE_START_POLL_INTERVAL_MS`, `OPENCODE_START_LAST_ATTEMPT_INDEX`, `OPENCODE_EXIT_REQUEST_TIMEOUT_MS`
- [ ] Eliminar las constantes de `typeOpencodeClient.ts` (solo interfaces)
- [ ] Agregar `export * from './consOpencodeClient'` en `constants/index.ts`
- [ ] Actualizar import en `engines/provider/opencode/client/opencodeClient.ts`

**Criterio de hecho:** `typeOpencodeClient.ts` tiene 0 constantes runtime. `consOpencodeClient.ts` tiene las 5.

---

### RD — Constantes runtime de `typeCompletionUi` → `constants/consCompletionUi.ts`

> **Motivo:** `types/typeCompletionUi.ts` mezcla el tipo `CompletionUiKind` con 2 constantes `as const`.

- [ ] Crear `constants/consCompletionUi.ts` con `COMPLETION_UI_SOURCE_VALUES`, `COMPLETION_UI_KIND_VALUES`
- [ ] Eliminar las constantes de `typeCompletionUi.ts` (solo el tipo)
- [ ] Agregar `export * from './consCompletionUi'` en `constants/index.ts`
- [ ] Actualizar imports en `zschemWebviewMessages.ts` y `GhostToolbar.tsx`

**Criterio de hecho:** `typeCompletionUi.ts` tiene 0 constantes runtime. `consCompletionUi.ts` tiene las 2.

---

### RE — Barrel `types/index.ts` sin fugas de constants

> **Motivo:** `types/index.ts` hace `export * from '../constants/consPipelineDefaults'`, lo cual exporta runtime constants desde un barrel de tipos.

- [ ] Quitar `export * from '../constants/consPipelineDefaults'` de `types/index.ts`
- [ ] Verificar que ningún import de `protocols/types` dependa de ese re-export

**Criterio de hecho:** `types/index.ts` solo exporta type definitions. 0 imports rotos.

---

### RF — Limpiezas menores (LOW)

> **Motivo:** Código muerto y micro-optimizaciones.

- [ ] `zschemWebviewMessages.test.ts`: eliminar `vi.mock('vscode', ...)` (los schemas no usan vscode)
- [ ] `guardOutboundForward.ts`: cambiar `new Set()` de módulo a inline en la función

**Criterio de hecho:** Sin mocks de vscode dentro de protocols. Sin carga side-effect a nivel de módulo.

---

## Estado

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| RA | Barrel `guards/index.ts` completo | 🟢 Completado |
| RB | `parseAgentDestination` → `guards/guardAgentDestination.ts` | 🟢 Completado |
| RC | Constantes OpenCode → `constants/consOpencodeClient.ts` | 🟢 Completado |
| RD | Constantes CompletionUi → `constants/consCompletionUi.ts` | 🟢 Completado |
| RE | Barrel `types/index.ts` sin constants | 🟢 Completado |
| RF | Limpiezas menores | 🟢 Completado |

## Bitácora

| Fecha | Fase | Nota |
| ----- | ---- | ---- |
| 2026-05-18 | — | Plan creado tras auditoría de protocols. Pendiente de inicio. |
| 2026-05-18 | RA | Barrel `guards/index.ts` completo — 4 exports agregados. 287 tests OK. |
| 2026-05-18 | RB | `parseAgentDestination` movida a `guards/guardAgentDestination.ts`. 287 tests OK. |
| 2026-05-18 | RC | 5 constantes OpenCode movidas a `constants/consOpencodeClient.ts`. 287 tests OK. |
| 2026-05-18 | RD | `COMPLETION_UI_*_VALUES` movidas a `constants/consCompletionUi.ts`. 287 tests OK. |
| 2026-05-18 | RE | `types/index.ts` ya no re-exporta `consPipelineDefaults`. 5 consumidores actualizados. 287 tests OK. |
| 2026-05-18 | RF | Mock `vscode` eliminado de test, `Set` inline en guard. 287 tests OK. |
