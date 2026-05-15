# Fase F — Limpiar código deprecado

> **Severidad:** 🟡 MEDIUM
> **Motivo:** Código muerto aumenta carga de mantenimiento sin beneficio

---

## Problema

- `SuggestionRequestGovernor.ts` en `system/policies/` tenía `@deprecated`, 0 imports en producción, pero mantenía test propio
- `core/memory/persist.ts` tenía funciones marcadas como deprecadas (ya eliminado en Fase E)

## Solución

Eliminar `SuggestionRequestGovernor` y su test. El directorio `system/policies/` quedó vacío y se eliminó.

---

## Subfases

### F1 — Auditar `SuggestionRequestGovernor`

- [x] Confirmar `grep -r "SuggestionRequestGovernor" src/ --include="*.ts"` = solo referencia en comment de `core/index.ts`
- [x] Confirmar que no hay imports en producción
- [x] Confirmar que ningún test de integración/e2e depende de él

**Criterio de hecho:** Certeza documentada de que no hay dependencias activas.

---

### F2 — Eliminar governor legacy

- [x] Eliminar `src/system/policies/SuggestionRequestGovernor.ts`
- [x] Eliminar `src/system/policies/SuggestionRequestGovernor.test.ts`
- [x] Eliminar `src/system/policies/` (quedó vacío)
- [x] Limpiar comentario en `core/index.ts`

**Criterio de hecho:** Los archivos no existen.

---

### F3 — Auditar `core/memory/persist.ts`

- [x] Ya eliminado en Fase E (todo `core/memory/` fue borrado)

---

### F4 — Verificar regresión

- [x] `npm run check` — 0 errores, 67 warnings (pre-existentes)
- [x] 46 test files, 250 tests pasando (antes 47/257; -1 file, -7 tests del governor)

---

## Estado

| Subfase                  | Estado |
| ------------------------ | ------ |
| F1 — Auditar governor    | [x]    |
| F2 — Eliminar governor   | [x]    |
| F3 — Auditar persist.ts  | [x]    |
| F4 — Verificar regresión | [x]    |

---

## Archivos resumen

| Archivo                                            | Acción          |
| -------------------------------------------------- | --------------- |
| `src/system/policies/SuggestionRequestGovernor.ts` | Eliminar        |
| `src/system/policies/SuggestionRequestGovernor.test.ts` | Eliminar   |
| `src/system/policies/`                             | Eliminar        |
| `src/core/index.ts`                                | Limpiar comment |
