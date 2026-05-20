# Fase B — `system/status/` → dominio de coordinación

> **Severidad:** 🔴 HIGH
> **Auditoría:** `system/status/` contiene lógica de dominio (orquestación de engines y destinos), no infraestructura transversal
> **Principio violado:** `system/` es para infraestructura; la coordinación de engines/destinos pertenece a una capa de dominio

---

## Problema

`src/system/status/ProviderStatusManager.ts` y `registerModules.ts` importan de `engines/` y `destinations/` para registrar y monitorear el estado de componentes de negocio. Esto es **orquestación de dominio**, no infraestructura. La carpeta `system/` debe contener solo código transversal sin dependencias de dominio.

## Solución

Crear `src/core/status/` como nuevo dominio de coordinación y mover allí `ProviderStatusManager`, `registerModules` y `types`. Alternativa: mover a un `src/monitoring/` independiente. Se prefiere `core/status/` por ser el monitoreo de componentes del negocio.

---

## Subfases

### B1 — Crear `src/core/status/` y mover archivos

- [x] Crear `src/core/status/` directorio
- [x] Mover `src/system/status/ProviderStatusManager.ts` → `src/core/status/ProviderStatusManager.ts`
- [x] Mover `src/system/status/registerModules.ts` → `src/core/status/registerModules.ts`
- [x] Mover `src/system/status/types.ts` → `src/core/status/types.ts`
- [x] Mover `src/system/status/README.md` → `src/core/status/README.md`
- [x] Mover `src/system/status/index.ts` → `src/core/status/index.ts`
- [x] Eliminar `src/system/status/` directorio

**Criterio de hecho:** Los archivos existen en `core/status/` y ya no están en `system/status/`.

---

### B2 — Actualizar imports en `core/status/`

- [x] `registerModules.ts`: imports relativos actualizados (`../../engines/`, `../../destinations/` desde `core/status/`)
- [x] `ProviderStatusManager.ts`: imports internos sin cambio (relativos al mismo directorio)
- [x] Verificar que no haya imports rotos hacia `system/status/`

**Criterio de hecho:** Todos los imports dentro de `core/status/` resuelven correctamente.

---

### B3 — Actualizar consumidores externos

- [x] `extension/extension.ts`: `../core/status/registerModules`
- [x] `api/protocols/inboundHandlers.ts`: `../../core/status`
- [x] `engines/copilot/copilotStatus.ts`: `../../core/status/types`
- [x] `engines/opencode/opencodeStatus.ts`: `../../core/status/types`
- [x] `engines/ollama/ollamaStatus.ts`: `../../core/status/types`
- [x] `destinations/copilotChat/copilotChatStatus.ts`: `../../core/status/types`
- [x] `destinations/vsOpenCodeX/vsOpenCodeXStatus.ts`: `../../core/status/types`

**Criterio de hecho:** `grep -r "system/status" src/` no devuelve resultados.

---

### B4 — Actualizar tests

- [x] `tests/ProviderStatusManager.test.ts`: `../src/core/status/`
- [x] `tests/integration/providerStatusFlow.test.ts`: `../../src/core/status/`
- [x] 282/282 tests en verde

**Criterio de hecho:** `npm run check` pasa.

---

### B5 — Actualizar barrel `core/index.ts`

- [x] Re-exportar `ProviderStatusManager`, `providerStatusManager`, tipos y `registerAllProviderModules` desde `core/index.ts`

**Criterio de hecho:** Los consumidores existentes pueden importar desde `core/status/` directamente o desde el barrel.

---

## Estado

| Subfase                               | Estado |
| ------------------------------------- | ------ |
| B1 — Mover archivos a `core/status/`  | [x]    |
| B2 — Actualizar imports internos      | [x]    |
| B3 — Actualizar consumidores externos | [x]    |
| B4 — Actualizar tests                 | [x]    |
| B5 — Barrel `core/index.ts`           | [x]    |

---

## Archivos resumen

| Archivo                                        | Acción                 |
| ---------------------------------------------- | ---------------------- |
| `src/system/status/ProviderStatusManager.ts`   | Mover a `core/status/` |
| `src/system/status/registerModules.ts`         | Mover a `core/status/` |
| `src/system/status/types.ts`                   | Mover a `core/status/` |
| `src/system/status/index.ts`                   | Mover a `core/status/` |
| `src/system/status/README.md`                  | Mover a `core/status/` |
| `src/extension/extension.ts`                   | Actualizar import      |
| `src/api/protocols/inboundHandlers.ts`         | Actualizar import      |
| `tests/ProviderStatusManager.test.ts`          | Actualizar import      |
| `tests/integration/providerStatusFlow.test.ts` | Actualizar import      |
