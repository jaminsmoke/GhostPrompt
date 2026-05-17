# Roadmaps v0.6.1

Extracción y consolidación de protocolos puros hacia `system/internals/protocols/`: tipos, constantes, validaciones y guards, eliminando definiciones duplicadas en webview, destinations y sugcore.

## Documentos

| Orden | Documento | Descripción |
| ----- | --------- | ----------- |
| 1 | [01-protocols-extraction.md](./01-protocols-extraction.md) | Fases de extracción, archivos afectados, tests y criterios de aceptación |

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

Convención de nombres: [`Docs/ExtensionArchitecture/NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md).

## Estado

- **Hito v0.6.0** publicado.
- **v0.6.1:** Extracción de protocols completada (PA–PM) en [`01-protocols-extraction.md`](./01-protocols-extraction.md).
