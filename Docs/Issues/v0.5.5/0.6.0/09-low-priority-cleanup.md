# Fase I — Low priority: limpiezas menores

> **Severidad:** 🟢 LOW
> **Motivo:** 6 hallazgos menores que mejoran consistencia y claridad del código

---

## Issues cubiertos

| #   | Hallazgo                                                 | Estado |
| --- | -------------------------------------------------------- | ------ |
| 9   | Barrel `core/types.ts` innecesario (1 línea re-export)   | ✅ Resuelto |
| 10  | Exportación dual de `projectBootstrapContext`            | ✅ Resuelto (Fase E) |
| 11  | Comando dev en producción (`discoverCursorChatCommands`) | ✅ Marcado |
| 12  | Tests de destino inconsistentes (planos vs anidados)     | ✅ Resuelto (Fase C) |
| 13  | Anidamiento profundo en `core/memory/` (informativo)     | ✅ Resuelto (Fase E) |
| 14  | Tests faltantes para módulos varios                      | ✅ Resuelto (Fase G) |

---

## Subfases

### I1 — Eliminar barrel `core/types.ts`

- [x] Mover contenido de `core/contracts/completion.ts` directamente a `core/types.ts`
- [x] Eliminar directorio `core/contracts/` (quedó redundante)
- [x] Todos los 13 importadores ya usaban `core/types` — sin cambios de import necesarios

**Criterio de hecho:** Una sola ruta canónica `core/types.ts` para los tipos de completion.

---

### I2 — Unificar exportación de `projectBootstrapContext`

- [x] SKIP — `core/memory/` fue eliminado en Fase E, incluyendo `projectBootstrapContext`

---

### I3 — Marcar `discoverCursorChatCommands.ts` como herramienta de desarrollo

- [x] Actualizar JSDoc del archivo con nota clara de que es una herramienta de dev/debugging
- [x] Documentar que será revisado/refactorizado/eliminado en un futuro roadmap del destino Cursor

**Criterio de hecho:** El archivo tiene comentario explícito de su naturaleza provisional.

---

### I4 — Homogeneizar tests de destino

- [x] YA HECHO en Fase C — todos los tests de destino están co-locados en `src/destinations/{provider}/`

---

### I5 — Añadir tests para módulos sin cobertura

- [x] YA HECHO en Fase G — Logger, collect, loading, outputChannel tienen tests

---

### I6 — Evaluar anidamiento `core/memory/`

- [x] SKIP — `core/memory/` fue eliminado en Fase E

---

### I7 — Verificar regresión

- [x] `npm run check` — 0 errores, 85 warnings (pre-existentes)
- [x] 50 test files, 286 tests pasando

---

## Estado

| Subfase                                         | Estado |
| ----------------------------------------------- | ------ |
| I1 — Barrel `core/types.ts`                     | [x]    |
| I2 — Exportación dual `projectBootstrapContext` | [x]    |
| I3 — Dev tool en destino                        | [x]    |
| I4 — Tests de destino homogéneos                | [x]    |
| I5 — Tests para módulos sin cobertura           | [x]    |
| I6 — Evaluar nesting (informativo)              | [x]    |
| I7 — Verificar regresión                        | [x]    |

---

## Archivos resumen

| Archivo                                                 | Acción                                    |
| ------------------------------------------------------- | ----------------------------------------- |
| `src/core/types.ts`                                     | Fusionar contenido de `contracts/completion.ts` |
| `src/core/contracts/`                                   | Eliminar (redundante)                     |
| `src/destinations/cursor/discoverCursorChatCommands.ts` | Marcar como dev tool provisional          |
