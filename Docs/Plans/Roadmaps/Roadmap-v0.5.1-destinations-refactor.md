# Roadmap v0.5.1 — Refactor `destinations/` + reubicación `vsOpenCodeXConnection`

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Decisiones de diseño confirmadas

| # | Decisión |
|---|----------|
| 1 | **Carpeta `destinations/`** — ubicación canónica para todos los destinos de prompt (copilotChat, vsOpenCodeX) |
| 2 | **Patrón análogo a `engines/`** — interfaz `DestinationProvider`, registro vía `destinationRegistry.ts`, cada destino en su subcarpeta |
| 3 | **`vsOpenCodeXBridge.ts` se mueve entero** a `engines/opencode/vsOpenCodeXConnection.ts` — 100% engine, no split |
| 4 | **Host se simplifica** — `ghostPromptWebviewInboundHandlers.ts` usa `getActiveDestinationProvider()` en vez de `if (getGhostPromptAgentDestination() === "vsOpenCodeX")` |
| 5 | **vsOpenCodeXGhostPromptUiBridge** va a `destinations/vsOpenCodeX/` — es reenvío de UI, parte del destino VSX |
| 6 | **Schema Zod** `"copilotChat" | "vsOpenCodeX"` se queda en `shared/webviewMessageSchemas.ts` |

---

## Progreso general

| Fase | Descripción | Estado | PR | Notas |
|------|-------------|--------|----|-------|
| **Fase 1** | Mover `vsOpenCodeXBridge.ts` → `engines/opencode/vsOpenCodeXConnection.ts` | 🟢 | — | completada 2026-05-13 |
| **Fase 2** | Crear `destinations/` + `destinationRegistry.ts` | 🟢 | — | completada 2026-05-13 |
| **Fase 3** | Migrar `ChatBridge.ts` → `destinations/copilotChat/copilotChatDestination.ts` | 🟢 | — | completada 2026-05-13 |
| **Fase 4** | Migrar `vsOpenCodeXGhostPromptUiBridge` + `notifyVsx` → `destinations/vsOpenCodeX/` | 🟢 | — | completada 2026-05-13 |
| **Fase 5** | Refactor `ghostPromptWebviewInboundHandlers.ts` para usar `destinationRegistry` | 🟢 | — | completada 2026-05-13 |
| **Fase 6** | Tests unitarios | ⚪ | — | |
| **Fase 7** | Documentación + validación | ⚪ | — | |

---

## Fase 1 — Mover `vsOpenCodeXBridge` a `engines/opencode/`

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 1.1 | Crear `engines/opencode/vsOpenCodeXConnection.ts` con imports actualizados | 🟢 |
| 1.2 | Actualizar import en `opencode/OpenCodeRuntime.ts` | 🟢 |
| 1.3 | Actualizar import en `host/ghostPromptHostWorkspaceGetters.ts` | 🟢 |
| 1.4 | Actualizar import en `host/notifyVsxAgentDestinationIfExtensionMissing.ts` | 🟢 |
| 1.5 | Eliminar `src/opencode/vsOpenCodeXBridge.ts` original | 🟢 |
| 1.6 | Verificar compilación y tests — 230 tests, 0 círculos, 0 errores | 🟢 |

**Criterio de salida:** `vsOpenCodeXBridge.ts` ya no existe. Todos los imports apuntan a `engines/opencode/vsOpenCodeXConnection.ts`.

---

## Fase 2 — Crear `destinations/` + `destinationRegistry.ts`

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 2.1 | Crear directorio `src/destinations/` y subdirectorios (`copilotChat/`, `vsOpenCodeX/`) | 🟢 |
| 2.2 | Definir interfaz `DestinationProvider` (id, sendPrompt?, forwardUi?) | 🟢 |
| 2.3 | Crear `destinationRegistry.ts` con `registerDestination()`, `getActiveDestinationProvider()`, `getDestinationProviderForId()` | 🟢 |
| 2.4 | Getters: migrar `getGhostPromptAgentDestination()` + `isVsOpenCodeXExtensionInstalled()` a `destinationRegistry` | 🟢 |
| 2.5 | Verificar compilación y tests — 230 tests, 0 círculos, 0 errores | 🟢 |

**Criterio de salida:** `destinationRegistry.ts` exporta interfaz y registro. Getters accesibles sin pasar por `ghostPromptHostWorkspaceGetters`.

---

## Fase 3 — Migrar `ChatBridge` a `destinations/copilotChat/`

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 3.1 | Crear `destinations/copilotChat/copilotChatDestination.ts` con `sendToChat()` y registrar en `destinationRegistry` | 🟢 |
| 3.2 | Actualizar imports en `host/ghostPromptWebviewInboundHandlers.ts` | 🟢 |
| 3.3 | Actualizar imports en tests (`MiniInputViewProvider.test.ts`, `ghostPromptWebviewInboundHandlers.test.ts`) | 🟢 |
| 3.4 | Eliminar `src/bridge/ChatBridge.ts` | 🟢 |
| 3.5 | Verificar compilación y tests — 230 tests, 0 círculos, 0 errores | 🟢 |

**Criterio de salida:** `ChatBridge.ts` eliminado. Destino Copilot Chat autoregistrado.

---

## Fase 4 — Migrar `vsOpenCodeXGhostPromptUiBridge` + `notifyVsx` a `destinations/vsOpenCodeX/`

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 4.1 | Crear `destinations/vsOpenCodeX/vsOpenCodeXDestination.ts` con `forwardGhostPromptInlineUiIfApplicable()` y registrar en `destinationRegistry` | 🟢 |
| 4.2 | Mover `notifyVsxAgentDestinationIfExtensionMissing` a `destinations/vsOpenCodeX/` (integrado en el mismo archivo) | 🟢 |
| 4.3 | Actualizar imports en host (`MiniInputViewProvider`, `extension.ts`, etc.) | 🟢 |
| 4.4 | Eliminar `src/host/vsOpenCodeXGhostPromptUiBridge.ts` y `src/host/notifyVsxAgentDestinationIfExtensionMissing.ts` | 🟢 |
| 4.5 | Verificar compilación y tests — 230 tests, 0 círculos, 0 errores | 🟢 |

**Criterio de salida:** Archivos fuente eliminados. Destino VSX autoregistrado.

---

## Fase 5 — Refactor `ghostPromptWebviewInboundHandlers` para usar `destinationRegistry`

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 5.1 | Reemplazar imports: `getGhostPromptAgentDestination()` + `getActiveDestinationProvider()` desde `destinationRegistry` | 🟢 |
| 5.2 | Verificar que `send` y `suggest` se saltan correctamente cuando destino es VSX (tests pasan con `workspaceConfigGetMock`) | 🟢 |
| 5.3 | Tests del handler actualizados — mock `destinationRegistry` con `getGhostPromptAgentDestination` + `getActiveDestinationProvider` | 🟢 |
| 5.4 | Verificar compilación y tests — 230 tests, 0 círculos, 0 errores | 🟢 |

**Criterio de salida:** Sin referencias directas a `getGhostPromptAgentDestination()` en handlers.

---

## Fase 6 — Tests unitarios

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 6.1 | Tests `destinationRegistry` — registro, resolución, activo por defecto | ⚪ |
| 6.2 | Tests `copilotChatDestination` — `sendToChat` mockea comando VS Code | ⚪ |
| 6.3 | Tests `vsOpenCodeXDestination` — forwarding condicional según destino | ⚪ |
| 6.4 | Tests `vsOpenCodeXConnection` (ya existe en `tests/vsOpenCodeXBridge.test.ts` si existe, si no crear) | ⚪ |
| 6.5 | Verificar que tests existentes de handlers/host siguen pasando | ⚪ |

**Criterio de salida:** `npm run test` pasa sin fallos.

---

## Fase 7 — Documentación y validación

### Subpasos trackeables

| # | Subpaso | Estado |
|---|---------|--------|
| 7.1 | Actualizar `Docs/ARCHITECTURE.md` — `destinations/` en module map, pipeline, sección "Why destinations?" | ⚪ |
| 7.2 | Actualizar `Docs/Owners.md` — `destinations/` en matriz y cobertura | ⚪ |
| 7.3 | Actualizar `CHANGELOG.md` — entrada v0.5.1 con refactor destinations | ⚪ |
| 7.4 | `npm run validate` pasa completo | ⚪ |

**Criterio de salida:** `npm run check` verde, docs actualizados.

---

## Referencias

- Roadmap Ollama (completado): [`Roadmap-v0.5.1-ollama-integration.md`](./Roadmap-v0.5.1-ollama-integration.md)
- Arquitectura general: [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Matriz motor-destino: [`Docs/Integrations/GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md)
