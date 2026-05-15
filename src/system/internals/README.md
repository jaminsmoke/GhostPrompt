# `system/internals/` — Contratos internos

> Contratos compartidos (`protocols/`). Sin estado mutable: la implementación vive en `system/runtime/`, `engines/provider/*/*Status` y `ui/provider/`.

---

## Estructura

```text
internals/
└── protocols/
    ├── types/          # CompletionResult, modelos, DEFAULT_*
    └── state/          # Tipos: loading, suggestion host, prompt history
```

---

## Qué entra aquí

- **Contratos** (`protocols/`) — formas de datos sin lógica de mutación

## Qué NO entra aquí

- Estado mutable del host → `system/runtime/`, `ui/provider/multiViewDraft.ts`
- Lógica de suggestions → `sugcore/`
- Configuración y routing de fuentes LM → `engines/`
- Logging → `system/log/`
- Protocolos webview ↔ host → `api/`
- Orquestación suggest → `system/runtime/`
