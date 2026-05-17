# `system/internals/` — Contratos internos

> **`protocols/`** centraliza contratos compartidos: **`constants/`**, **`validations/`** (p. ej. Zod en `schemas/`), **`types/`**, **`guards/`**, **`state/`**, y otras familias que se añadan al migrar desde `api/` u otros módulos. **`config/`** agrupa lectores de `vscode.workspace` para claves GhostPrompt acopladas a esos contratos (ver `config/README.md`). Sin estado mutable: la implementación vive en `system/runtime/`, `engines/provider/*/*Status` y `ui/provider/`.

---

## Estructura

```text
internals/
├── config/              # Lectores GhostPrompt → `vscode.workspace` (ver config/README.md)
└── protocols/
    ├── constants/
    ├── validations/
    │   └── schemas/      # Zod (host↔webview); ver protocols/README.md
    ├── guards/
    ├── types/
    └── state/
```

Detalle de contratos: [`protocols/README.md`](./protocols/README.md). Lectores de configuración: [`config/README.md`](./config/README.md).

---

## Qué entra aquí

- **Contratos** (`protocols/*`) — datos, constantes, predicados y tipos de estado sin mutación en esta capa
- **Config host** (`config/*`) — lectura de claves `ghostPrompt.*` usadas por runtime/UI cuando conviene acoplarlas a tipos de `protocols/` sin mezclarlas con el barrel `api/getters/` (la configuración de **fuentes LM** sigue en `engines/config/`)

## Qué NO entra aquí

- Estado mutable del host → `system/runtime/`, `ui/provider/multiViewDraft.ts`
- Lógica de suggestions → `sugcore/`
- Configuración y routing de fuentes LM → `engines/`
- Logging → `system/log/`
- Parsers del boundary con logging → `api/protocols/` (schemas en `protocols/validations/schemas/`)
- Orquestación suggest → `system/runtime/`
