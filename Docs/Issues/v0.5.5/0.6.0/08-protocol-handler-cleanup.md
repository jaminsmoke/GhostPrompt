# Fase H — Separar lógica de negocio del protocol handler

> **Severidad:** 🟡 MEDIUM
> **Motivo:** Un router de mensajes no debe contener lógica de negocio de engines

---

## Problema

`handleGhostPromptInboundUpdateSetting` en `inboundHandlers.ts` contenía lógica de arranque/parada de modelos Ollama (`ollamaModelManager.startModel`, `ollamaModelManager.stopModel`). Esta lógica de **engine lifecycle** pertenecía al entry point de la UI, no a un handler de protocolo.

## Solución

Extraer la lógica de lifecycle de Ollama a un callback `onSettingChanged` en `GhostPromptInboundDispatchServices`, inyectado desde `MiniInputViewProvider`.

---

## Subfases

### H1 — Extender `GhostPromptInboundDispatchServices`

- [x] Añadir callback opcional `onSettingChanged?: (key: 'selectedModelId' | 'completionProvider', value: string) => Promise<void>`
- [x] Tipo definido en el mismo archivo `inboundHandlers.ts`

**Criterio de hecho:** El tipo `GhostPromptInboundDispatchServices` incluye el callback.

---

### H2 — Refactorizar `handleGhostPromptInboundUpdateSetting`

- [x] Eliminar import de `../../engines/ollama/ollamaModelManager`
- [x] Eliminar import de `looksLikeOllamaModelId` de `core/routing/sources`
- [x] Reemplazar lógica de Ollama por `services.onSettingChanged?.(key, value)`
- [x] Mantener import de `providerStatusManager` (usado en `startProvider`/`stopProvider` cases)

**Criterio de hecho:** `inboundHandlers.ts` ya no importa de `engines/ollama/`.

---

### H3 — Inyectar el callback desde `MiniInputViewProvider`

- [x] Añadir import de `ollamaModelManager`, `providerStatusManager`, `looksLikeOllamaModelId`
- [x] Crear método estático `_onSettingChanged` con la lógica extraída
- [x] Pasar `onSettingChanged: MiniInputViewProvider._onSettingChanged` en los dispatch services

**Criterio de hecho:** El lifecycle de Ollama se invoca desde el callback inyectado en el entry point.

---

### H4 — Tests actualizados

- [x] `ghostPromptWebviewInboundHandlers.test.ts` — pasa sin cambios (el callback es opcional)
- [x] `MiniInputViewProvider.test.ts` — pasa sin cambios (mock del dispatch services)
- [x] 21 tests relacionados pasan (protocols + provider)

**Criterio de hecho:** `npm run check` pasa (los 2 fallos en `ollamaApiClient.test.ts` son pre-existentes, no relacionados con este cambio).

---

## Estado

| Subfase                         | Estado |
| ------------------------------- | ------ |
| H1 — Extender dispatch services | [x]    |
| H2 — Refactor handler           | [x]    |
| H3 — Inyectar callback          | [x]    |
| H4 — Tests actualizados         | [x]    |

---

## Archivos resumen

| Archivo                                                | Acción                                 |
| ------------------------------------------------------ | -------------------------------------- |
| `src/api/protocols/inboundHandlers.ts`                 | Extraer lógica Ollama, añadir callback |
| `src/ui/provider/MiniInputViewProvider.ts`             | Inyectar callback + método estático    |
