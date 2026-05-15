# Roadmaps v0.6 — Destinations

Planificación de **nuevos destinos de agente** (`ghostPrompt.agentDestination`): dónde se envía el **prompt final** tras el composer inline de GhostPrompt.

## Documentos

| Orden | Documento                                                        | Descripción                                                                                                                        |
| ----- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [01-cursor-chat-destination.md](./01-cursor-chat-destination.md) | Destino **Cursor Chat**: inyectar el texto del Send en el chat nativo de Cursor (mismo rol que `copilotChat`, no Cloud Agents API) |

## Contexto

- **Motor** (Copilot LM, OpenCode, Ollama) y **destino** (Send) siguen separados — ver [`GhostPrompt-motor-destino-matrix.md`](../../../Integrations/GhostPrompt-motor-destino-matrix.md).
- Hoy: `copilotChat` (`workbench.action.chat.open`) y `vsOpenCodeX` (superficie delegada; sin Send desde GP).
- **Cursor** entra como tercer destino **solo para Send**: el usuario sigue usando la webview GhostPrompt (inline + suggestions); al enviar, el texto pasa al chat de Cursor.

## Estado global

| Hito                                         | Estado                                  |
| -------------------------------------------- | --------------------------------------- |
| Roadmap Cursor (este folder)                 | En curso                                |
| Fase A — contrato en código                  | Hecho                                   |
| Fase 0 — comando IDE                         | Hecho (v1 `workbench.action.chat.open`) |
| Fase B — proveedor `cursorChat`              | Hecho (QA manual fase F)                |
| Fase C+ — UI dropdown + matriz + QA release  | Pendiente                               |
| Release minor (p. ej. **0.6.x** / **0.7.0**) | Por definir al cerrar fases             |
