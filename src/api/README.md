# `api/` — API interna webview↔host

> Dominio canónico que gestiona toda la comunicación entre el webview (UI del mini-input) y el extension host.

---

## Rol

`api/` es la **capa de protocolo** de GhostPrompt. Gestiona la validación de mensajes entrantes desde el webview, el dispatch a los handlers correctos, la construcción y envío del envelope `settings`, y la aplicación de cambios de configuración. También expone los getters de configuración del workspace.

**No debe contener:**

- Lógica de suggestion (eso es `sugcore/`)
- Providers de vistas VS Code (eso es `vscode/`)
- HTML/CSP generation (eso es `vscode/`)
- Lógica de negocio de motores (eso es `engines/`)

---

## Estructura

```text
api/
├── protocols/
│   ├── webviewProtocols.ts    # Validación Zod boundary postMessage (inbound + outbound)
│   └── inboundHandlers.ts     # Router/dispatch de mensajes inbound por tipo
├── settings/
│   ├── settingsPostMessage.ts # Construye y envía el envelope `settings` al webview
│   └── applyWebviewUpdate.ts  # Aplica `updateSetting` via `vscode.workspace` config API
├── getters/
│   └── workspaceGetters.ts    # Lectores de `vscode.workspace.getConfiguration` + destino agente
└── index.ts                   # Barrel público (re-exports de todo el dominio)
```

---

## Flujo de mensajes

### Webview → Host (inbound)

```text
Webview.postMessage({ type: 'suggest', text, captureId })
    │
    ▼
`api/protocols/webviewProtocols.ts` — parseWebviewInboundMessage (Zod validation)
    │
    ▼ (si válido)
`api/protocols/inboundHandlers.ts` — dispatchGhostPromptInboundMessage
    ├── init → handleGhostPromptInboundInit
    ├── suggest → system/runtime → handleGhostPromptSuggest
    ├── draftChanged → handleGhostPromptInboundDraftChanged
    ├── updateSetting → api/settings → applyWebviewUpdateSetting
    ├── accept → handleGhostPromptInboundAccept (log suggestion)
    └── send → handleGhostPromptInboundSend (enviar al destino)
```

### Host → Webview (outbound)

```text
`api/settings/settingsPostMessage.ts` — buildAndPostGhostPromptSettings
    ├── Collect enabled sources, model list, policy, style, context, language, debug
    ├── Build envelope { type: 'settings', settings: {...} }
    ├── Validate with parseOutboundSettingsEnvelope (Zod)
    └── webview.postMessage(validated)
```

---

## Mensajes inbound soportados

| `type`          | Campos                  | Rol                                                   |
| --------------- | ----------------------- | ----------------------------------------------------- |
| `init`          | —                       | Primera carga de la vista                             |
| `suggest`       | `text`, `captureId`     | Pedir suggestion para texto parcial                   |
| `draftChanged`  | `text`, `originViewId`  | Sincronizar borrador entre vistas                     |
| `updateSetting` | `key`, `value`          | Cambiar configuración desde chips                     |
| `accept`        | `suggestion`, `context` | Usuario aceptó suggestion con Tab                     |
| `send`          | `text`                  | Enviar prompt al destino (Copilot Chat / VSOpenCodeX) |

---

## Contratos Zod

Los schemas canónicos viven en `api/contracts/webviewMessageSchemas.ts`. `api/protocols/webviewProtocols.ts` los re-exporta y expone las funciones de parseo:

- `parseWebviewInboundMessage(raw)` → `WebviewInboundMessage | undefined`
- `parseOutboundSettingsEnvelope(raw)` → validated envelope

---

## Dependencias

| Importa de                               | Por qué                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `sugcore/`                               | Types, `listSuggestionModels`, `getCompletionUiKind`, etc. |
| `system/internals/state/sessionStore`   | Estado compartido (draft, model, captureId)                |
| `engines/status/completionSourceStatusManager` | Estado de fuentes LM (start/stop, refresh)         |
| `system/runtime`                         | `handleGhostPromptSuggest` para el mensaje `suggest`       |
| `system/contracts/webviewMessageSchemas` | Schemas Zod canónicos                                      |
| `system/log`                             | Logging estructurado, conversation y suggestions           |
| `system/log`                             | Debug toggle check                                         |
| `destinations/destinationRegistry`       | Resolución de destino agente                               |

---

## Tests relevantes

| Test                                             | Qué cubre                      |
| ------------------------------------------------ | ------------------------------ |
| `protocols/webviewProtocols.test.ts`             | Parseo Zod de mensajes inbound |
| `protocols/inboundHandlers.test.ts`              | Dispatch por tipo de mensaje   |
| `settings/applyWebviewUpdate.test.ts`            | Aplicación de `updateSetting`  |
| `contracts/webviewMessageSchemas.test.ts`        | Validación de schemas Zod      |
| `provider/MiniInputViewProvider.test.ts`         | Flujo end-to-end con mocks     |
