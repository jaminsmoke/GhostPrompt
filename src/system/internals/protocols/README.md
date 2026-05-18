# `system/internals/protocols/` — Contratos internos

> **Capa de protocolo** compartida entre host, engines, runtime y destinos: tipos, constantes, validación (Zod y otras), predicados (guards), estado declarativo del host, etc. Sin estado mutable en tiempo de ejecución (eso vive en `system/runtime/`, `ui/provider/`, …).

Convención de nombres de archivo: [`Docs/ExtensionArchitecture/NamingConventions.md`](../../../Docs/ExtensionArchitecture/NamingConventions.md).

---

## Estructura

```text
protocols/
├── constants/
│   ├── consDestinations.ts
│   ├── consPipelineDefaults.ts
│   ├── consOutboundForwardKinds.ts
│   ├── consVsOpenCodeX.ts
│   ├── consCursorChat.ts
│   ├── consLogLimits.ts
│   └── index.ts
├── validations/
│   └── schemas/
│       ├── zschemWebviewMessages.ts
│       ├── zschemWebviewMessages.test.ts
│       └── index.ts
├── guards/
│   ├── guardCopilotLm.ts
│   ├── guardCopilotLm.test.ts
│   ├── guardBoundSuggestion.ts
│   ├── guardBoundSuggestion.test.ts
│   ├── guardOutboundForward.ts
│   ├── guardProviderId.ts
│   ├── guardProviderId.test.ts
│   ├── guardLogLevel.ts
│   ├── guardModelRouting.ts
│   ├── guardModelRouting.test.ts
│   └── index.ts
├── types/
│   ├── typeCompletion.ts
│   ├── typeDestinations.ts
│   ├── typeSuggestionStyle.ts
│   ├── typeOpencodeClient.ts
│   ├── typeCompletionUi.ts
│   ├── typeLog.ts
│   └── index.ts
└── state/
    ├── loading/
    │   ├── stateLoadingPhase.ts
    │   ├── stateLoadingLabels.ts
    │   └── index.ts
    └── provider/
        ├── stateProviderId.ts
        ├── stateProviderRecord.ts
        ├── stateProviderModule.ts
        └── index.ts
```

---

## Qué entra en cada familia

| Carpeta | Rol |
|--------|-----|
| **`constants/`** (`cons*`) | Literales, `as const`, IDs de comando, defaults de pipeline. |
| **`validations/schemas/`** (`zschem*`) | Esquemas Zod y tipos inferidos; sin `safeParse` con logging ni VS Code. |
| **`guards/`** (`guard*`) | Predicados y funciones puras (errores LM, recorte de texto, forward VSX). |
| **`types/`** (`type*`) | Interfaces, unions, tipos de request/result (sin `vscode`; p. ej. `CompletionCancellationToken`). |
| **`state/`** (`state*`) | Formas de estado del host (loading, provider) sin mutación. |

## Qué NO entra aquí

- Estado mutable y orquestación → `system/runtime/`, `ui/provider/`
- Implementación de logging (`Logger`, transports, `LogManager`) → `system/log/` (importa tipos y guards desde aquí; el barrel público re-exporta contratos puros)
- Parsers del boundary con logging → `api/boundary/` (importan `zschem*` desde aquí)
