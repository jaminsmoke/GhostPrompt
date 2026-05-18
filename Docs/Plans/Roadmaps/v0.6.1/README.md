# Roadmaps v0.6.1

Extracción y consolidación de protocolos puros hacia `system/internals/protocols/`: tipos, constantes, validaciones y guards, eliminando definiciones duplicadas en webview, destinations y sugcore.

## Documentos

| Orden | Documento | Descripción |
| ----- | --------- | ----------- |
| 1 | [01-protocols-extraction.md](./01-protocols-extraction.md) | Fases PA–PM: `SuggestionStyle`, destinos, schemas webview, renaming, símbolos |
| 2 | [02-protocols-extraction-log.md](./02-protocols-extraction-log.md) | Fase QA (cerrada) + backlog QB/QD: log → `protocols/`, routing guards, `instruction` |

## Contexto

La v0.6 ya estableció `system/internals/protocols/` como la capa de contratos puros (sin side effects, sin imports de VS Code). La v0.6.1 prioriza **poblar esa capa** extrayendo tipos, constantes y schemas que aún viven fuera:

- `SuggestionStyle` → `protocols/types/typeSuggestionStyle.ts` — PA 🟢
- Destination types/constants (`destinations/`) — PB 🟢
- Schemas duplicados en webview — PC 🟢
- Tipos redundantes en webview (`ui/webview/react/types.ts`) — PD 🟢
- Renaming físico bajo `protocols/` (prefijos `cons` / `type` / `guard` / `state` / `zschem`) — PE 🟢
- Adaptador webview `parseWebviewInbound.ts` — PF 🟢
- Constantes Cursor `consCursorChat.ts` — PH 🟢
- Tipo `CompletionUiKind` (`typeCompletionUi.ts`) — PI 🟢
- Guard `isProviderId` (`guardProviderId.ts`) — PJ 🟢
- Shim `sugcore/sugstyle/` eliminado — PL 🟢
- Renombrado símbolos export (`AGENT_DESTINATION_IDS`, `parseAgentDestination`, …) — PG 🟢
- `CompletionCancellationToken` (sin `vscode` en protocols) — PK 🟢
- Barrido docs y rutas legacy — PM 🟢
- **v0.6.1 protocols extraction:** completado (PA–PM). Ver [`01-protocols-extraction.md`](./01-protocols-extraction.md).
- Extracción log → `protocols/` (`consLogLimits`, `typeLog`, `guardLogLevel`) — QA 🟢
- Guards routing `looksLike*ModelId` (`guardModelRouting`) — QB 🟢
- Destino `buildCompletionInstruction` (`sugcore/`) — QD ⚪

Convención de nombres: [`Docs/ExtensionArchitecture/NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md).

## Estado

- **Hito v0.6.0** publicado.
- **v0.6.1 fase 1:** Extracción de protocols (PA–PM) completada en [`01-protocols-extraction.md`](./01-protocols-extraction.md).
- **v0.6.1 fase 2:** Extracción de `system/log/` (QA.1–QA.7) completada en [`02-protocols-extraction-log.md`](./02-protocols-extraction-log.md).
- **v0.6.1 fase 3:** Backlog QB/QD (routing guards, `instruction`) — pendiente en el mismo doc.
