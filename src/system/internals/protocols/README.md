# `system/internals/protocols/` — Contratos internos

> Tipos y contratos compartidos entre host, engines y runtime. Sin implementación ni mutación de estado.

---

## Estructura

```text
protocols/
├── types/              # Contratos de completado (CompletionResult, modelos, params)
│   ├── completion.ts
│   ├── params.ts
│   └── index.ts
└── state/              # Contratos de estado (fases, sesión)
    ├── loading/
    │   ├── loadingPhase.ts
    │   ├── loadingLabels.ts
    │   └── index.ts
    ├── sessionTypes.ts
    └── index.ts
```

---

## Qué entra aquí

- Tipos de request/result de motores LM (`types/completion.ts`)
- Constantes por defecto del pipeline (`types/params.ts`)
- Unions e interfaces de estado (`state/*`)

## Qué NO entra aquí

- Stores y managers → `../state/`
- Mensajes webview Zod → `api/contracts/`
