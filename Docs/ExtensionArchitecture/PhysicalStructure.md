# Estructura física de la extensión

> Referencia de diseño pre-scaffolding basada en la arquitectura Option C (seleccionada).
> Cada archivo tiene una responsabilidad única y acotada.

---

## Árbol de directorios

```
VsCodeExtension-InlineChatSuggestions/
│
├── src/                              # Código fuente TypeScript (lado host)
│   ├── extension.ts                  # Entry point: activate / deactivate
│   ├── MiniInputViewProvider.ts      # WebviewViewProvider — registro y ciclo de vida
│   ├── ChatBridge.ts                 # Puente hacia el chat oficial de Copilot
│   └── ConversationLog.ts            # Lectura / escritura del log en conversation.md
│
├── webview/                          # Assets del lado webview (sandboxed)
│   ├── index.html                    # Plantilla HTML de la vista mini-input
│   ├── main.js                       # Lógica client-side: input, ghost-text display, postMessage
│   └── style.css                     # Estilos del mini-input
│
├── resources/                        # Assets estáticos (íconos, etc.)
│   └── icon.png                      # Ícono de la extensión (Marketplace y activity bar)
│
├── Docs/                             # Documentación del proyecto (no se empaqueta)
│   ├── Plans/
│   │   ├── Option-A--Markdown-as-Input-Source.md
│   │   ├── Option-B--Own-WebviewView-Panel.md
│   │   └── Adopted/
│   │       └── Option-C--Hybrid-TextEditor-Plus-Positioning.md
│   ├── ExtensionArchitecture/
│   │   └── PhysicalStructure.md      ← este archivo
│   └── MyConversation/
│       └── conversation.md           # Log de prompts enviados (runtime artifact)
│
├── .vscode/
│   ├── launch.json                   # Configuración de depuración (Extension Development Host)
│   └── tasks.json                    # Tarea de build (tsc --watch)
│
├── package.json                      # Manifiesto: contributes.views, activationEvents, scripts
├── tsconfig.json                     # Configuración TypeScript
├── .eslintrc.json                    # Lint rules
├── .vscodeignore                     # Exclusiones del paquete .vsix
└── README.md                         # Documentación de usuario
```

---

## Responsabilidades por archivo

### `src/extension.ts` — Entry point

- Exporta `activate(context)` y `deactivate()`.
- Instancia `MiniInputViewProvider` y lo registra:
  ```ts
  vscode.window.registerWebviewViewProvider('inlineChatInput.miniInput', provider)
  ```
- Registra cualquier comando adicional de la extensión.
- No contiene lógica de negocio — solo wiring.

---

### `src/MiniInputViewProvider.ts` — WebviewViewProvider

- Implementa `vscode.WebviewViewProvider`.
- Método `resolveWebviewView`: carga `index.html`, inyecta los URI de `main.js` y `style.css`
  a través de `webview.asWebviewUri`.
- Escucha mensajes `postMessage` del webview:
  - `{ type: 'send', text: string }` → llama a `ChatBridge.sendToChat(text)`
  - `{ type: 'logUpdate', text: string }` → llama a `ConversationLog.append(text)`
- Gestiona el ciclo de vida del panel (visible/oculto).

---

### `src/ChatBridge.ts` — Puente al chat de Copilot

- Única responsabilidad: enviar un prompt al chat oficial.
  ```ts
  export async function sendToChat(query: string): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
  }
  ```
- Aislado en su propio módulo para facilitar el mock en tests y futuros cambios de API.

---

### `src/ConversationLog.ts` — Log persistente

- Lee y hace append al archivo `Docs/MyConversation/conversation.md`.
- Cada entrada tiene timestamp y el texto del prompt.
- El archivo se abre con `vscode.workspace.openTextDocument` para activar las
  inline suggestions nativas de Copilot sobre él (TextDocument subyacente).

---

### `webview/index.html` — Plantilla HTML

- Esqueleto mínimo: un `<textarea>` (o `<div contenteditable>`) como área de input.
- Referencia a `main.js` y `style.css` usando los URI seguros inyectados por el provider.
- Aplica Content Security Policy restrictiva (solo `nonce` permitido).

---

### `webview/main.js` — Lógica client-side

- Escucha el evento `keydown` para detectar `Enter` (enviar) y `Tab` (aceptar ghost-text).
- Envía mensajes al host vía `acquireVsCodeApi().postMessage(...)`.
- Recibe mensajes del host (p.ej. para limpiar el input tras envío exitoso).
- No depende de ningún framework — vanilla JS para minimizar bundle size.

---

### `webview/style.css` — Estilos del mini-input

- Integración visual con el tema activo de VS Code usando las CSS variables de tema:
  `--vscode-input-background`, `--vscode-input-foreground`, `--vscode-focusBorder`, etc.
- Sin dependencias externas de CSS.

---

### `package.json` — Manifiesto

Secciones clave:

```json
{
  "name": "inline-chat-suggestions",
  "displayName": "Inline Chat Suggestions",
  "activationEvents": ["onView:inlineChatInput.miniInput"],
  "contributes": {
    "views": {
      "workbench.panel.chat": [
        {
          "type": "webview",
          "id": "inlineChatInput.miniInput",
          "name": "Prompt Assistant",
          "when": "true"
        }
      ]
    }
  }
}
```

> `workbench.panel.chat` es el contenedor built-in de VS Code verificado en Option C.
> `activationEvents` con `onView:` garantiza que la extensión solo se activa cuando
> el panel del chat es visible — mínimo impacto en el startup de VS Code.

---

### `.vscodeignore` — Exclusiones del paquete

Los siguientes directorios **no se incluyen** en el `.vsix` publicado:

```
Docs/**
src/**          # Solo se empaqueta el output compilado en out/
.vscode/**
node_modules/**
**/*.map
**/*.ts
```

---

## Diagrama de dependencias entre módulos

```
extension.ts
    ├── MiniInputViewProvider.ts
    │       ├── ChatBridge.ts
    │       └── ConversationLog.ts
    └── (comandos adicionales futuros)

webview/main.js  ←→  MiniInputViewProvider.ts   (postMessage / onDidReceiveMessage)
```

---

## Separación host / webview

| Capa           | Archivos                        | Acceso a API de VS Code |
| -------------- | ------------------------------- | ----------------------- |
| Host (Node.js) | `src/*.ts`                      | ✅ Completo              |
| Webview (DOM)  | `webview/main.js`, `index.html` | ❌ Solo via postMessage  |

Esta separación es obligatoria por el modelo de seguridad de VS Code.
Todo lo que requiera `vscode.*` debe vivir en `src/`.

---

## Convenciones de nomenclatura

| Elemento           | Convención            | Ejemplo                            |
| ------------------ | --------------------- | ---------------------------------- |
| Clases / tipos     | PascalCase            | `MiniInputViewProvider`            |
| Funciones          | camelCase             | `sendToChat`, `resolveWebviewView` |
| Archivos `src`     | PascalCase (= clase)  | `ChatBridge.ts`                    |
| Archivos `webview` | kebab-case / plain    | `main.js`, `style.css`             |
| IDs de vista       | `camelCase.camelCase` | `inlineChatInput.miniInput`        |

---

> **Estado**: Estructura lista para scaffolding.
> Próximo paso: `yo code` o `npm create vscode-extension` con plantilla TypeScript,
> luego ajustar el árbol generado para que coincida con esta spec.
