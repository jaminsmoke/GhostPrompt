# Fase A — Core → UI: eliminar dependencia directa

> **Severidad:** 🔴 HIGH
> **Auditoría:** `core/suggest/runSuggest.ts:11` importa directamente `ui/notifications/suggestionNotification`
> **Principio violado:** Core debe ser independiente de la capa de UI

---

## Problema

`src/core/suggest/runSuggest.ts` importa `maybeNotifySuggestionIssue` desde `../../ui/notifications/suggestionNotification`. Si la UI cambia o se elimina el módulo de notificaciones, el core se rompe.

## Solución

Convertir la notificación en un **callback** dentro de `GhostPromptSuggestDeps` (patrón de inyección de dependencias), de modo que core solo dependa de un contrato (tipo de función) y la UI se inyecte desde el punto de entrada (`extension.ts` o `inboundHandlers.ts`).

---

## Subfases

### A1 — Definir el callback en `GhostPromptSuggestDeps`

- [x] Crear tipo `NotifyIssueCallback = (result: CompletionResult) => void` en `core/suggest/runSuggest.ts`
- [x] Añadir `notifyIssue?: NotifyIssueCallback` opcional en `GhostPromptSuggestDeps`

**Archivos afectados:**

- `src/core/suggest/runSuggest.ts`

**Criterio de hecho:** `GhostPromptSuggestDeps` tiene el campo opcional `notifyIssue`.

---

### A2 — Refactorizar `runGhostPromptSuggestPipeline`

- [x] Reemplazar `maybeNotifySuggestionIssue(...)` por `deps.notifyIssue?.(...)`
- [x] Eliminar el import directo de `../../ui/notifications/suggestionNotification`

**Archivos afectados:**

- `src/core/suggest/runSuggest.ts`

**Criterio de hecho:** `runSuggest.ts` ya no importa ningún módulo de `ui/`. El único cambio funcional es que la notificación pasa por el callback.

---

### A3 — Inyectar el callback real desde el punto de entrada

- [x] En `MiniInputViewProvider.ghostPromptSuggestDeps()`, incluir `notifyIssue: maybeNotifySuggestionIssue`
- [x] Verificar que el callback importa desde `ui/notifications/suggestionNotification` **solo** en el punto de entrada

**Archivos afectados:**

- `src/ui/provider/MiniInputViewProvider.ts`

**Criterio de hecho:** La única importación de `ui/notifications/` hacia core está en `api/` o `extension/`, no en `core/`.

---

### A4 — Tests actualizados

- [x] Verificar que los tests existentes de `runGhostPromptSuggestPipeline` compilan sin el import directo
- [x] Actualizar `minimalDeps()` en tests para incluir `notifyIssue: maybeNotifySuggestionIssue`

**Archivos afectados:**

- `tests/host/ghostPromptSuggestPipeline.test.ts`

**Criterio de hecho:** `npm run check` pasa. Tests en verde.

---

## Estado

| Subfase                         | Estado |
| ------------------------------- | ------ |
| A1 — Callback en deps           | [x]    |
| A2 — Refactor runSuggest        | [x]    |
| A3 — Inyectar desde entry point | [x]    |
| A4 — Tests actualizados         | [x]    |

---

## Archivos resumen

| Archivo                                         | Rol                                              |
| ----------------------------------------------- | ------------------------------------------------ |
| `src/core/suggest/runSuggest.ts`                | Añadir callback type + field; eliminar import UI |
| `src/api/protocols/inboundHandlers.ts`          | Inyectar callback real al construir deps         |
| `tests/host/ghostPromptSuggestPipeline.test.ts` | Actualizar mocks si aplica                       |
