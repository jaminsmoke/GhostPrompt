# `vscode/` — Integración VS Code

> Dominio canónico que contiene todo lo que interactúa directamente con la API de VS Code: providers de vistas, generación de HTML/CSP para webviews, y notificaciones host.

---

## Rol

`vscode/` es la **capa de integración** con VS Code. Contiene el `WebviewViewProvider` que registra las vistas en el Activity Bar y Panel, la generación de HTML seguro con CSP nonces, y las notificaciones no intrusivas del host.

**No debe contener:**
- Lógica de suggestion (eso es `core/`)
- Contratos Zod de mensajes (eso es `api/`)
- Orquestación de pipeline (eso es `core/pipeline/`)
- Lógica de motores (eso es `engines/`)

---

## Estructura

```
vscode/
├── MiniInputViewProvider.ts   # WebviewViewProvider (sidebar + panel)
├── webviewHtml.ts             # HTML template + CSP nonce generation
├── suggestionNotification.ts  # vscode.window.showWarningMessage notifications
└── index.ts                   # Barrel público
```

---

## `MiniInputViewProvider`

### Rol

Registra las vistas de GhostPrompt en dos contenedores:
- **Activity Bar** (`ghostPrompt.input`) — sidebar view
- **Panel** (`ghostPrompt.inputPanel`) — bottom panel view

Ambas vistas comparten el **mismo estado** a través de `GhostPromptSessionStore`.

### Ciclo de vida

```
extension.ts: activate(context)
    ├── new MiniInputViewProvider(context, viewId) — sidebar
    ├── new MiniInputViewProvider(context, panelViewId) — panel
    ├── vscode.window.registerWebviewViewProvider(viewId, sidebarProvider)
    └── vscode.window.registerWebviewViewProvider(panelViewId, panelProvider)

provider.resolveWebviewView(view, context, token)
    ├── Configure webview: enableScripts, cspSource
    ├── Build HTML: buildGhostPromptWebviewHtml(...)
    ├── Set webview.html
    ├── Register onDidReceiveMessage handler
    └── Post initial settings: buildAndPostGhostPromptSettings(...)
```

### Static methods

| Método | Rol |
|--------|-----|
| `refreshSettingsAllViews()` | Re-envía settings a todas las vistas registradas |
| `refreshAllViews()` | Re-renderiza todas las vistas (HTML completo) |

---

## `webviewHtml.ts`

Genera el HTML del webview con sustitución segura de placeholders:

| Placeholder | Reemplazo |
|-------------|-----------|
| `{{nonce}}` | Nonce aleatorio de 32 chars para CSP |
| `{{cspSource}}` | `webview.cspSource` |
| `{{styleUri}}` | URI segura de `webview/style.css` |
| `{{scriptUri}}` | URI segura de `webview/dist/main.js` |
| `{{viewIdScript}}` | ID de contribución de vista |
| `{{capabilitiesScript}}` | Payload de capacidades del layout |

---

## `suggestionNotification.ts`

Notificaciones no intrusivas (`vscode.window.showWarningMessage`) para fallos accionables:

- **Throttle:** 90 segundos por tipo de mensaje
- **Empty reasons:** `no-model`, `no-included-model`, `premium-quota-blocked`
- **Error patterns:** premium quota, OpenCode server, network errors, auth errors, rate limits

---

## Dependencias

| Importa de | Por qué |
|------------|---------|
| `api/protocols/webviewProtocols` | Parseo de mensajes inbound |
| `api/protocols/inboundHandlers` | Dispatch de mensajes |
| `api/settings/settingsPostMessage` | Envío de settings al webview |
| `api/getters/workspaceGetters` | Lectores de configuración |
| `core/pipeline` | `handleGhostPromptSuggest` para el pipeline |
| `core/session/GhostPromptSessionStore` | Estado compartido |
| `projectMemory/` | Project memory reconcile |
| `destinations/vsOpenCodeX/vsOpenCodeXDestination` | Forward UI a VSOpenCodeX |

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `MiniInputViewProvider.test.ts` | Flujo completo: init, suggest, accept, send, settings |
| `webviewToolbarParity.test.ts` | Paridad dual vista (sidebar + panel) |
| `webviewThemeTokens.test.ts` | Tokens CSS del webview |
