# `api/` — API interna webview↔host

> Capa delgada entre el webview (UI) y el extension host: boundary postMessage, dispatch inbound y ensamblador de settings.

---

## Rol

`api/` orquesta la comunicación webview↔host. Los **contratos puros** viven en `system/internals/protocols/`; la **configuración** (`ghostPrompt.*`) en `system/internals/config/`.

**No debe contener:**

- Lógica de suggestion (→ `system/runtime/` + `engines/`)
- Providers de vistas VS Code (→ `ui/provider/`)
- Lectura/escritura de settings (→ `system/internals/config/`)

---

## Estructura

```text
api/
├── boundary/
│   ├── webviewProtocols.ts      # Parseo Zod + logging en el límite postMessage
│   ├── inboundHandlers.ts       # Router/dispatch de mensajes inbound por tipo
│   └── testing/                 # Mocks para tests de boundary
├── settings/
│   └── settingsPostMessage.ts   # Ensambla y envía el envelope `settings` al webview
└── index.ts                     # Barrel público (re-exporta boundary, settings, config, destinations)
```

Configuración canónica en `system/internals/config/`:

```text
config/
├── read/
│   ├── workspaceConfigGetters.ts
│   └── readGhostPromptSuggestionModelPolicy.ts
└── write/
    └── applyWebviewUpdateSetting.ts
```

---

## Flujo de mensajes

### Webview → Host (inbound)

```text
Webview.postMessage({ type: 'suggest', text, captureId })
    │
    ▼
api/boundary/webviewProtocols.ts — parseWebviewInboundMessage
    │
    ▼
api/boundary/inboundHandlers.ts — dispatchGhostPromptInboundMessage
    ├── init → handleGhostPromptInboundInit
    ├── suggest → system/runtime/suggestRuntime
    ├── updateSetting → config/write/applyWebviewUpdateSetting
    └── …
```

### Host → Webview (settings)

```text
api/settings/settingsPostMessage.ts — buildAndPostGhostPromptSettings
    │
    ▼
api/boundary/webviewProtocols.ts — parseOutboundSettingsEnvelope
    │
    ▼
webview.postMessage({ type: 'settings', settings })
```

---

## Tests

| Archivo | Qué cubre |
| ------- | --------- |
| `boundary/webviewProtocols.test.ts` | Parseo boundary + paridad schema con `protocols/` |
| `boundary/ghostPromptWebviewInboundHandlers.test.ts` | Dispatch por tipo |
| `system/internals/config/write/applyWebviewUpdateSetting.test.ts` | `updateSetting` → `vscode.workspace` |
