# `ui/` — Dominio de interfaz de usuario

> Dominio canónico que contiene todo el código de interfaz de usuario de GhostPrompt, tanto el que corre en el webview (sandbox del navegador) como el que corre en el extension host (Node).

---

## Rol

`ui/` agrupa todo el código relacionado con la interfaz de usuario de GhostPrompt. Se divide en tres subdominios según dónde se ejecuta cada pieza:

- **`ui/webview/`** — Corre en el webview sandbox (navegador). Contiene HTML, CSS, JS del mini-input.
- **`ui/provider/`** — Corre en Node (extension host). Contiene el `WebviewViewProvider` y la generación de HTML/CSP.
- **`ui/notifications/`** — Corre en Node. Contiene notificaciones al usuario via `vscode.window.showWarningMessage`.

**No debe contener:**
- Lógica de suggestion (eso es `core/`)
- Protocolos de mensajes (eso es `api/`)
- Lógica de motores (eso es `engines/`)

---

## Estructura

```
ui/
├── README.md
├── webview/                          # Sandbox del navegador (IIFE bundle via esbuild)
│   ├── index.html                    # Template HTML con placeholders {{nonce}}, {{cspSource}}, etc.
│   ├── style.css                     # Estilos del webview (basados en variables VS Code)
│   ├── tsconfig.json                 # TypeScript config para el webview (lib: ["ES2022", "DOM"])
│   ├── dist/
│   │   └── main.js                   # Build output (esbuild)
│   ├── main.ts                       # Entry point: init, handlers, message loop
│   ├── globals.d.ts                  # Type declarations para window.__ghostPrompt*
│   ├── lib/
│   │   ├── composeLabels.ts          # Textos cortos para chips de configuración
│   │   ├── htmlEscape.ts             # HTML entity escaping
│   │   └── userErrorMessage.ts       # Mensajes de error para el usuario
│   ├── protocol/
│   │   └── postToHost.ts             # Validación Zod antes de postMessage al host
│   └── panels/
│       ├── capabilities.ts           # Detección de capacidades por viewId
│       └── register.ts               # Handlers específicos por panel
├── provider/                         # Extension host (Node)
│   ├── MiniInputViewProvider.ts      # WebviewViewProvider (sidebar + panel)
│   ├── webviewHtml.ts                # HTML template + CSP nonce generation
│   └── index.ts                      # Barrel
└── notifications/                    # Extension host (Node)
    ├── suggestionNotification.ts     # Notificaciones vscode.window.showWarningMessage
    └── index.ts                      # Barrel
```

---

## Flujo de UI

```
extension.ts: activate
    │
    ▼
ui/provider/MiniInputViewProvider.ts
    ├── Resolve webview view (sidebar o panel)
    ├── ui/provider/webviewHtml.ts → build HTML con CSP
    └── ui/webview/index.html + ui/webview/dist/main.js ← carga en el webview
    │
    ▼
ui/webview/main.ts (corre en el navegador)
    ├── window.__ghostPromptCapabilities → detecta panel
    ├── ui/webview/lib/composeLabels → etiquetas de chips
    ├── ui/webview/protocol/postToHost.ts → valida mensajes antes de enviar
    └── ui/webview/lib/userErrorMessage → mensajes de error
    │
    ▼
postMessage → api/protocols/inboundHandlers.ts → core/pipeline/
```

---

## Paneles (sidebar vs bottom panel)

GhostPrompt registra dos vistas `WebviewViewProvider` (sidebar `ghostPrompt.input` y panel `ghostPrompt.inputPanel`) que comparten el **mismo bundle HTML/JS/CSS**. La diferenciación es via `window.__ghostPromptCapabilities.viewId` inyectado en el HTML.

Ambos paneles deben mantener **paridad funcional**: los chips, el protocolo de mensajes y el comportamiento de suggestion deben ser idénticos. Solo cambian hints de layout (compact toolbar en sidebar).

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `MiniInputViewProvider.test.ts` | Flujo completo: init, suggest, accept, send, settings |
| `webviewToolbarParity.test.ts` | Paridad dual vista (sidebar + panel) |
| `webviewThemeTokens.test.ts` | Tokens CSS del webview |
| `webview/composeLabels.test.ts` | Etiquetas de configuración |
| `webview/userErrorMessage.test.ts` | Mensajes de error |
