# `sugcore/` — Dominio de suggestions

> Valor central del producto: **cómo se pide, correlaciona, cancela y entrega** una suggestion, más contratos compartidos con los motores. No infra genérica de VS Code ni composición de listas solo para chips de UI.

**Roadmap de reorganización:** [`Docs/Plans/Roadmaps/v0.6/Restructure/01-slim-core.md`](../../Docs/Plans/Roadmaps/v0.6/Restructure/01-slim-core.md)  
**Ownership global:** [`Docs/Owners.md`](../../Docs/Owners.md)

---

## Qué sí entra en `sugcore/`

- Tipos y resultados de completion (`types.ts`).
- Reglas de construcción del prompt (`rules/instruction.ts`).
- Resolución de **fuentes** y routing a motor (`routing/sources.ts`).

## Qué no debe vivir aquí

- **Lista unificada multi-motor para el selector** → `engines/catalog/mergedModelCatalog.ts` (`listMergedSuggestionModels`).
- Integración VS Code de vistas/HTML/CSP → `ui/provider/`.
- Protocolos Zod webview ↔ host → `api/`.
- **Estado interno** (session store, provider status, loading phases) → `system/internals/states/`.
- **Runtime / orquestación** del pipeline suggest → `system/runtime/`.
- **Infraestructura** de streaming, config readers → `system/internals/`.

---

## Estructura actual

```text
sugcore/
├── types.ts                    # Domain types canónicos
├── rules/
│   └── instruction.ts          # buildCompletionInstruction
├── routing/                    # Pendiente de evaluar destino final
│   └── sources.ts              # Completion source routing (resolveCompletionSourceForRequest)
└── README.md
```

---

## Flujo del pipeline (`suggest`)

```mermaid
sequenceDiagram
  participant W as Webview
  participant A as api (handlers)
  participant P as system/runtime
  participant S as system/internals/states/session
  participant E as engines
  W->>A: suggest(text, captureId)
  A->>P: runGhostPromptSuggestPipeline
  P->>S: prepareSuggestionRequest
  P->>E: requestCompletion (motor resuelto)
  E-->>P: CompletionResult
  P->>W: broadcast loading / suggestion / empty / error
```

Pasos alineados con `system/runtime/suggest.ts`: preparar token y `captureId`, resolver fuente (`sugcore/routing/sources` + registry), llamar al `CompletionProvider`, broadcast a la UI.

---

## Dependencias típicas

| Importa desde                             | Motivo                                    |
| ----------------------------------------- | ----------------------------------------- |
| `engines/engineRegistry`                  | Obtener el motor por `CompletionSourceId` |
| `system/internals/states/session`         | Session store (captureId, cancelación)    |
| `system/internals/states/loading`         | Loading phases y textos de UI             |
| `system/runtime`                          | Pipeline de orquestación suggest          |
| `system/log`                              | Logging opcional de performance           |
| `api/protocols/webviewProtocols`          | Tipo del mensaje inbound `suggest`        |

---

## Tests relevantes

| Test                                          | Cubre                            |
| --------------------------------------------- | -------------------------------- |
| `system/runtime/suggest.test.ts`              | Pipeline suggest con mocks       |
| `system/internals/states/session.test.ts`     | Estado, cancelación, captureId   |
| `CopilotCompletion.test.ts` / `opencodeLmEngine` tests | Vía engines, contratos con sugcore |
| `sugcore/routing/completionSources.test.ts`   | Routing de fuentes               |
| `system/internals/states/loading.test.ts`     | Textos de fase                   |
| `system/internals/streaming/collect.test.ts`  | Streaming de respuesta LM        |

El merge de catálogos multi-motor se cubre en **`tests/mergedModelCatalog.test.ts`** (módulo bajo `engines/catalog/`).
