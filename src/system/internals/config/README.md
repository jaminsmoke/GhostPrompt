# `system/internals/config/` — Configuración GhostPrompt en el host

> Lectura y escritura de claves `ghostPrompt.*` vía `vscode.workspace`, tipadas con contratos de `protocols/`.

La configuración de **fuentes de completado** (`enabledCompletionSources`, UI kind, etc.) sigue en `engines/config/completionSources.ts`.

---

## Estructura

```text
config/
├── read/
│   ├── workspaceConfigGetters.ts           # selectedModelId, style, debounce, Ollama URL, contexto editor
│   └── readGhostPromptSuggestionModelPolicy.ts
├── write/
│   └── applyWebviewUpdateSetting.ts        # Mensajes `updateSetting` del webview
└── index.ts                                # Barrel read + write
```

---

## Reglas

- **read/** — solo lectura; sin side effects salvo consultar VS Code.
- **write/** — persiste cambios desde el webview; importa tipos desde `protocols/validations/schemas/`, no desde `api/boundary/`.
- Destinos de agente (`getAgentDestination`, etc.) viven en `destinations/`; no en `workspaceConfigGetters`.

---

## Consumidores típicos

| Consumidor | Importa |
| ---------- | ------- |
| `ui/provider/MiniInputViewProvider` | `config/read/*`, `api/boundary/*` |
| `api/boundary/inboundHandlers` | `config/write/applyWebviewUpdateSetting` |
| `api/settings/settingsPostMessage` | `config/read`, `destinations/` |
