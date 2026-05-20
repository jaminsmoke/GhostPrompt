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

## Claves del pipeline suggest (lectura canónica)

| Clave `ghostPrompt.*` | Getter | Consumidor principal |
| --------------------- | ------ | -------------------- |
| `maxSuggestionChars` | `getGhostPromptMaxSuggestionChars()` | `suggest/suggestPipeline` → motores → `buildCompletionInstruction` + `finalizeEngineCompletionResult` |
| `minCharsForSuggestion` | `getGhostPromptMinCharsForSuggestion()` | `suggest/suggestPipeline` (umbral `too-short`) |
| `suggestionDebounceMs` | `getGhostPromptSuggestionDebounceMs()` | `settingsPostMessage` → webview |
| `suggestionModelPolicy` | `readGhostPromptSuggestionModelPolicy()` | `suggest/suggestPipeline`, catálogos |
| `selectedModelId` | `getGhostPromptSelectedModelId()` | routing + suggest |
| `enabledCompletionSources` | `engines/config/completionSources` | routing (no duplicar aquí) |

---

## Consumidores típicos

| Consumidor | Importa |
| ---------- | ------- |
| `ui/provider/MiniInputViewProvider` | `config/read/*`, `api/boundary/*` |
| `api/boundary/inboundHandlers` | `config/write/applyWebviewUpdateSetting` |
| `api/settings/settingsPostMessage` | `config/read`, `destinations/` |
| `system/runtime/suggest/suggestPipeline` | `getGhostPromptMinCharsForSuggestion`, estilo vía deps |
