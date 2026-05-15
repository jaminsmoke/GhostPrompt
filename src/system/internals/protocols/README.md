# `system/internals/protocols/` — Contratos internos

> Tipos y contratos compartidos entre host, engines y runtime. Sin implementación ni mutación de estado.

---

## Estructura

```text
protocols/
├── guards/             # Heurísticas puras sobre errores/respuestas LM (sin estado)
│   ├── copilotLm.ts
│   └── copilotLm.test.ts
├── types/              # Contratos de completado (CompletionResult, modelos, params)
│   ├── completion.ts
│   ├── params.ts
│   └── index.ts
└── state/              # Contratos de estado del host
    ├── loading/
    │   ├── loadingPhase.ts
    │   ├── loadingLabels.ts
    │   └── index.ts
    ├── provider/
    │   ├── providerId.ts
    │   ├── providerState.ts
    │   ├── providerStatusModule.ts
    │   └── index.ts
    └── index.ts
```

---

## Qué entra aquí

- Heurísticas sin estado sobre errores o texto del modelo (`guards/*`)
- Tipos de request/result de motores LM (`types/completion.ts`)
- Constantes por defecto del pipeline (`types/params.ts`)
- Unions e interfaces de estado (`state/*`)

## Qué NO entra aquí

- Estado mutable → `system/runtime/`, `ui/provider/`
- Mensajes webview Zod → `api/contracts/`
