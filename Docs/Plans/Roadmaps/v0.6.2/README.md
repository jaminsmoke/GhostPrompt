# Roadmap v0.6.2

Consolidación de límites **host ↔ webview** y cierre de deuda arquitectónica tras QG (`api/boundary/`, `config/`, ESLint en verde). La v0.6.1 cerró extracción e higiene de `protocols/`; la v0.6.2 prioriza **una sola historia de contratos** sin duplicar carpetas ni reintroducir `api/protocols/`.

## Documentos

| Orden | Documento | Descripción |
| ----- | --------- | ----------- |
| 1 | [01-consolidation-boundary-webview.md](./01-consolidation-boundary-webview.md) | Fases **FA–FE**: shims, parse webview, tipos UI, docs, cierre release |
| 2 | [02-chat-webview-presuggestions.md](./02-chat-webview-presuggestions.md) | Fases **FF–FJ**: stale captures, sync dual-view, overlay ghost, UX chat, QA |

## Contexto

| Hito previo | Estado |
| ----------- | ------ |
| v0.6.1 PA–PM (extracción `protocols/`) | Completado — [`v0.6.1/01-protocols-extraction.md`](../v0.6.1/01-protocols-extraction.md) |
| v0.6.1 QG (`api/boundary/`, `config/read|write/`) | Completado — [`v0.6.1/02-protocols-extraction-log.md`](../v0.6.1/02-protocols-extraction-log.md) |
| v0.6.1 higiene `protocols/` (RA–RF) | Completado — [`v0.6.1/03-protocols-hygiene.md`](../v0.6.1/03-protocols-hygiene.md) |
| v0.6.1 higiene webview (PA–PD) | Completado — [`v0.6.1/04-webview-ui-hygiene.md`](../v0.6.1/04-webview-ui-hygiene.md) |
| ESLint `npm run check` | Verde en `feature/react-vite-tailwind-webview` (commit lint 0.6.2) |

## Principios (sin regresión)

1. **Contrato puro** → `system/internals/protocols/` (Zod, tipos, guards, `cons*`). Sin `vscode`, sin logging.
2. **Parseo host** → `api/boundary/webviewProtocols.ts` (Zod + `getLogger` en fallos).
3. **Parseo webview** → `ui/webview/react/validators/` (mismo schema, **sin** importar `api/` ni `system/log/`).
4. **No nueva capa** “protocolos en ui”: solo adaptadores finos y tests de paridad.

Convenciones: [`Docs/ExtensionArchitecture/NamingConventions.md`](../../ExtensionArchitecture/NamingConventions.md).  
Límites de capa: [`Docs/Owners.md`](../../Owners.md).

## Estado del roadmap

| Fase | Tema | Estado |
| ---- | ---- | ------ |
| **FA** | Eliminar `api/protocols/` y alinear entrada `api/` | Completado |
| **FB** | Paridad parse mensajes webview ↔ host | Completado |
| **FC** | Afinar barrel de tipos React (`ui/webview/react/types.ts`) | Completado |
| **FD** | Docs / CHANGELOG / referencias `api/protocols` | Completado |
| **FE** | Verificación release 0.6.2 | En curso (VSIX `0.6.2` empaquetado; smoke manual pendiente) |
| **FF** | Invalidación captureId stale en edición local | Completado |
| **FG** | Limpieza suggestion en draftSync / draftHydrate dual-view | Completado |
| **FH–FJ** | Overlay ghost, UX chat, QA | Planificado |

## Verificación habitual (cada fase)

1. `npm run check`
2. Inspección manual opcional: panel GhostPrompt + canal **GhostPrompt Log** tras `npm run vsix` si la fase toca webview o `extension/`.
