# `ui/` — Dominio de interfaz de usuario

<!-- markdownlint-disable MD032 MD040 MD060 -->

> Dominio canónico que contiene todo el código de interfaz de usuario de GhostPrompt, tanto el que corre en el webview (sandbox del navegador) como el que corre en el extension host (Node).

---

## Rol

`ui/` agrupa todo el código relacionado con la interfaz de usuario de GhostPrompt. Se divide en tres subdominios según dónde se ejecuta cada pieza:

- **`ui/webview/`** — Corre en el webview sandbox (navegador). Contiene HTML, CSS, JS del mini-input.
- **`ui/provider/`** — Corre en Node (extension host). Contiene el `WebviewViewProvider` y la generación de HTML/CSP.
- **`ui/notifications/`** — Corre en Node. Contiene notificaciones al usuario via `vscode.window.showWarningMessage`.

**No debe contener:**

- Lógica de suggestion (eso es `engines/` + `system/runtime/`)
- Protocolos de mensajes (eso es `api/`)
- Lógica de motores (eso es `engines/`)

---

## Estructura

```
ui/
├── README.md
├── webview/                          # Sandbox del navegador (React + Vite)
│   ├── tsconfig.json                 # TypeScript config para el webview (lib: ["ES2022", "DOM"])
│   ├── globals.d.ts                  # Type declarations para window.__ghostPrompt*
│   ├── dist/
│   │   └── react/                    # Vite build output for the React webview
│   │       └── index.html
│   ├── react/
│   │   ├── index.html                # Vite entry template
│   │   ├── index.css                 # Tailwind + global styles
│   │   ├── css.d.ts
│   │   ├── main.tsx                  # React entry point
│   │   ├── App.tsx                   # Raíz: delega en GhostPromptRoot
│   │   └── surfaces/                 # ChatApp (sidebar) y HubApp (panel)
│   ├── globals.d.ts                  # Type declarations para window.__ghostPrompt*
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
    └── ui/webview/dist/react/index.html (React bundle generado por Vite) ← carga en el webview
    │
    ▼
ui/webview/react/main.tsx (corre en el navegador)
    ├── window.__ghostPromptViewId → GhostPromptRoot → ChatApp | HubApp
    └── …
    │
    ▼
postMessage → api/boundary/inboundHandlers.ts → system/runtime/suggest/suggestPipeline
```

---

## Paneles (sidebar vs panel inferior)

GhostPrompt registra dos vistas `WebviewViewProvider` que comparten el **mismo bundle** Vite. El host inyecta `window.__ghostPromptViewId` (`ghostPrompt.input` vs `ghostPrompt.inputPanel`).

- **Sidebar (`ghostPrompt.input`):** superficie **chat** — compositor de prompt, overlay ghost, envío y chip **Destino** (v0.6.2 plan 05, fase FW).
- **Panel (`ghostPrompt.inputPanel`):** superficie **hub** — chips Motor, Modelo, Composición, debug y sección Estadísticas (placeholder); sin textarea de chat.

El estado de producto (`ghostPrompt.*`) sigue siendo único; ambas vistas reciben mensajes `settings` desde el host.

---

## Tests relevantes

| Test                            | Qué cubre                                             |
| ------------------------------- | ----------------------------------------------------- |
| `MiniInputViewProvider.test.ts` | Flujo completo: init, suggest, accept, send, settings |
| `webviewToolbarParity.test.ts`  | Chips y `data-key` estables en toolbar/paneles        |
| `webviewSurfaces.test.ts`       | Reparto chat vs hub (plan 05 FW)                      |
| `webviewThemeTokens.test.ts`    | Tokens CSS del webview                                |
| `src/ui/webview/react/App.test.tsx`    | React webview render smoke test                       |
