# Cursor — integración GhostPrompt

## Nota de diseño

En esta implementación distinguimos claramente entre el IDE host y el destino del prompt.

- **Cursor** es el IDE/hospedador donde corre la extensión.
- **`cursorChat`** es el destino técnico dentro de GhostPrompt para enviar texto al chat nativo de Cursor.
- Esto es una implementación temporal hasta que se estabilice la integración de Cursor como destino de agente.
- El motor Copilot de VS Code no puede compartirse automáticamente con Cursor; si Cursor no expone `vscode.lm`, Copilot no es un engine válido en ese host.

## Dos superficies distintas

| Superficie                                        | Uso en GhostPrompt                                                                       | Documentación                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Cursor IDE** (extension API, `vscode.commands`) | Destino **`cursorChat`**: abrir/rellenar el chat nativo al pulsar **Send** en la webview | Esta sección                                       |
| **Cursor Cloud Agents API** (HTTP, API keys)      | **Fuera de v1** del destino chat; sería un destino/producto distinto                     | [cursor.com/docs/api](https://cursor.com/docs/api) |

---

## Destino GhostPrompt `cursorChat` (fase A — contrato)

| Decisión                         | Valor v1                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| ID en settings / `DestinationId` | `cursorChat`                                                                       |
| Superficie GhostPrompt           | Completa (inline + suggest + Send), igual que `copilotChat`                        |
| Gating VSOpenCodeX               | **No** aplica: solo `vsOpenCodeX` desactiva suggest/send en la webview             |
| Send en host                     | `handleGhostPromptInboundSend` → `getActiveDestinationProvider().sendPrompt(text)` |
| Auto-envío tras inyectar         | **No** — solo abrir/rellenar; el usuario envía desde el panel Cursor               |
| Detección de host                | `isCursorDesktopHost()` — `vscode.env.appName` contiene `"cursor"`                 |
| Flag en `settings` al webview    | `cursorDesktopHost: boolean` (UI puede ocultar el destino si es `false`)           |
| Errores                          | `showErrorMessage` si `sendPrompt` falla                                           |

**Implementación:** [`cursorChatDestination.ts`](../../../src/destinations/cursor/cursorChatDestination.ts) registrado en `extension.ts`.

---

## Fase 0 — Comando IDE (cerrada v1)

### Comando principal (v1)

| Campo                   | Valor                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **`commandId`**         | `workbench.action.chat.open`                                                                                        |
| **Argumento preferido** | `{ query: string }` — texto del Send de GhostPrompt                                                                 |
| **Argumento fallback**  | `string` (mismo texto) si el host rechaza el objeto                                                                 |
| **Comportamiento**      | Abre el panel de chat y **rellena** el input; **no** envía automáticamente                                          |
| **Paridad**             | Mismo contrato que [`copilotChatDestination.ts`](../../../src/destinations/copilotChat/copilotChatDestination.ts)   |
| **Registro en Cursor**  | Comprobar con `ghostPrompt.discoverCursorChatCommands` (debe listar `workbench.action.chat.open` como _registered_) |

### Descubrimiento reproducible

1. En **Cursor Desktop**, F1 → **GhostPrompt: Discover Cursor Chat Commands (dev)**.
2. Revisar el canal **GhostPrompt Cursor Commands**: `appName`, total de comandos, candidatos filtrados (`chat`, `composer`, `agent`, `aichat`, `cursor`, …).
3. Código: [`cursorChatCommands.ts`](../../../src/destinations/cursor/cursorChatCommands.ts) — `filterCursorChatCandidateCommands`, `appendCursorChatCommandDiscovery`.

### Comandos descartados o no usados en v1

| Comando / familia                              | Motivo                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `workbench.action.chat.submit`                 | Reportado como **ausente** en Cursor (foro Cursor, 2025); v1 no hace auto-send |
| `workbench.action.chat.stopListeningAndSubmit` | Envío por voz; fuera de alcance Send texto                                     |
| `composer.*` / `aichat.*` (salvo sondeo)       | Superficie Composer/Agent distinta; no sustituye chat panel sin validación E2E |
| Cloud Agents API                               | Destino HTTP distinto (fuera de v1)                                            |

### Fallback en VS Code puro

Si `ghostPrompt.agentDestination` = `cursorChat` pero el host **no** es Cursor: Send falla o el comando no existe; la UI debería ocultar la opción cuando `cursorDesktopHost === false` (fase C).

---

## Referencias de código

- Registro de destinos: [`src/destinations/destinationRegistry.ts`](../../../src/destinations/destinationRegistry.ts)
- Send Cursor: [`src/destinations/cursor/cursorChatDestination.ts`](../../../src/destinations/cursor/cursorChatDestination.ts)
- Comandos / descubrimiento: [`src/destinations/cursor/cursorChatCommands.ts`](../../../src/destinations/cursor/cursorChatCommands.ts)
- Patrón Copilot Chat: [`src/destinations/copilotChat/copilotChatDestination.ts`](../../../src/destinations/copilotChat/copilotChatDestination.ts)
- Send desde webview: [`src/api/protocols/inboundHandlers.ts`](../../../src/api/protocols/inboundHandlers.ts)
- Detección host: [`src/destinations/cursor/cursorHost.ts`](../../../src/destinations/cursor/cursorHost.ts)
- Roadmap: [`01-cursor-chat-destination.md`](../../Plans/Roadmaps/v0.6/Destinations/01-cursor-chat-destination.md)
