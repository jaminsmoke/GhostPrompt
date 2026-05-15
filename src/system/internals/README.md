# `system/internals/` — Contratos y estado interno

> Contratos compartidos (`protocols/`) y estado mutable del host (`state/`).

---

## Estructura

```text
internals/
├── protocols/
│   ├── types/          # CompletionResult, modelos, DEFAULT_*
│   └── state/          # Tipos: loading phases, session, provider
└── state/              # Runtime: stores, managers
    ├── sessionStore.ts
    └── registerModules.ts
```

---

## Qué entra aquí

- **Contratos** (`protocols/`) — formas de datos sin lógica de mutación
- **Estado runtime** (`state/`) — singletons y managers del ciclo de vida de la extensión

## Qué NO entra aquí

- Lógica de suggestions → `sugcore/`
- Configuración y routing de fuentes LM → `engines/`
- Logging → `system/log/`
- Protocolos webview ↔ host → `api/`
- Orquestación suggest → `system/runtime/`
