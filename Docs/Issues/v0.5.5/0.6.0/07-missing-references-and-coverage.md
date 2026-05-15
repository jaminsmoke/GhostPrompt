# Fase G — Referencias faltantes y cobertura de tests

> **Severidad:** 🟡 MEDIUM
> **Motivo:** Documentación incorrecta y módulos sin cobertura aumentan riesgo de regresión

---

## Problemas

1. **Test referenciado inexistente:** `core/README.md` lista `loading.test.ts` pero el archivo no existía
2. **Módulos sin cobertura:** Logger, streaming collect, output channel transport
3. **README desactualizado:** referenciaba `memory/` (eliminado en Fase E), `SuggestionRequestGovernor` (eliminado en Fase F), rutas de tests espejo (co-locados en Fase C)

---

## Subfases

### G1 — Corregir referencia a `loading.test.ts`

- [x] Crear `src/core/presentation/loading.test.ts` con test de todas las fases
- [x] Cubre los 12 valores de `SuggestionLoadingPhase` → texto localizado

**Criterio de hecho:** El test existe y pasa.

---

### G2 — Añadir tests para logging system

- [x] `src/system/log/Logger.test.ts` — testear creación, niveles (debug/info/warn/error), metadata, cause
- [x] `src/system/log/outputChannelTransport.test.ts` — testear `formatLocalTime`, `formatLine` (data, error, breadcrumbs), `id` estable
- [x] `LogManager.ts` — clase privada; comportamiento ejercido a través de funciones exportadas (`getLogger`, `initGhostPromptLogging`, `flushLogCapture`) y cubierto por `logSubsystem.vscode.test.ts`
- [x] `emitContract.ts` — solo tipos (`EmitPayload`, `LogEmitSink`), sin código runtime que testear
- [x] `transports/file.ts` — cubierto por `logSubsystem.vscode.test.ts` (write+dispose, disabled)

**Criterio de hecho:** Logger y OutputChannelTransport tienen cobertura unitaria directa.

---

### G3 — Añadir tests para streaming

- [x] `src/core/streaming/collect.test.ts` — testear `collectResponseText` con: chunk único, múltiples chunks, vacío, markdown, timeout

**Criterio de hecho:** `collectResponseText` tiene cobertura de casos borde.

---

### G4 — Añadir tests para memory IO

- [x] SKIP — `core/memory/` fue eliminado en Fase E

---

### G5 — Actualizar READMEs desactualizados

- [x] `src/core/README.md`: eliminadas referencias a `memory/`, `SuggestionRequestGovernor`, `projectBootstrapContext.test.ts`, `projectMemoryStore.test.ts`. Añadido `collect.test.ts`.
- [x] `src/api/README.md`: actualizada ruta de schemas (`api/contracts/` en vez de `system/contracts/`). Actualizadas rutas de tests co-locados.

**Criterio de hecho:** Los READMEs no referencian archivos o rutas que no existen.

---

### G6 — Verificar regresión

- [x] `npm run check` — 0 errores, 70 warnings (pre-existentes)
- [x] 50 test files, 281 tests pasando (antes 46/250; +4 files, +31 tests nuevos)

---

## Estado

| Subfase                           | Estado |
| --------------------------------- | ------ |
| G1 — Referencia `loading.test.ts` | [x]    |
| G2 — Tests logging system         | [x]    |
| G3 — Tests streaming              | [x]    |
| G4 — Tests memory IO              | [x]    |
| G5 — READMEs actualizados         | [x]    |
| G6 — Verificar regresión          | [x]    |

---

## Archivos resumen

| Archivo                            | Acción                    |
| ---------------------------------- | ------------------------- |
| `src/core/presentation/loading.test.ts` | Crear              |
| `src/core/streaming/collect.test.ts`    | Crear              |
| `src/system/log/Logger.test.ts`         | Crear              |
| `src/system/log/outputChannelTransport.test.ts` | Crear      |
| `src/core/README.md`               | Actualizar                |
| `src/api/README.md`                | Actualizar                |
