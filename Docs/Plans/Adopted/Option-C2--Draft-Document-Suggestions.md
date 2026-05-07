# Option C2 — Draft Document Suggestions (variante adoptada de C)

## Contexto y relación con C

La **Option C original** presuponía que se podía anclar la vista al contenedor
`workbench.panel.chat`, que resultó ser un punto de extensión interno de VS Code no
accesible. La vista se reubicó correctamente en la activity bar y el panel inferior
(ambos funcionando), por lo que la UX de posicionamiento de C queda resuelta.

La variante **C2** sustituye únicamente la parte de *captura de suggestions*: en lugar
de intentar leer el ghost-text del webview antes de que se acepte (imposible por el
sandbox), se apoya en un `TextDocument` subyacente que Copilot sí puede observar, y
se extrae la suggestion mediante un ciclo *trigger → commit → diff → revert*.

El documento **no se muestra al usuario en ningún momento**. VS Code lo mantiene
abierto en memoria para que Copilot genere completions; el foco nunca abandona la
WebviewView del Prompt Assistant desde la perspectiva del usuario.

---

## Insight clave

> Copilot genera inline suggestions sobre cualquier `TextEditor` que tenga el cursor
> posicionado. Para capturar esa suggestion sin mostrarla, basta con:
> 1. Abrir el draft en un editor con `preserveFocus: true` (el usuario no lo ve con foco).
> 2. Darle foco mínimo (~200 ms) solo para ejecutar el ciclo trigger/commit.
> 3. Leer el diff antes/después → texto de la suggestion.
> 4. Revertir el documento al texto original del usuario.
> 5. Devolver la suggestion al webview como ghost-text visual.
>
> El usuario percibe únicamente el ghost-text en nuestra UI; el documento de draft
> opera en segundo plano de forma transparente.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────┐
│         Prompt Assistant (WebviewView)          │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  textarea: "hola, esto es "               │  │
│  │            _una prueba de Copilot_  ← ghost text  │
│  │                          [Enviar ↵]       │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
          ↕ postMessage (suggest / suggestion / send)
┌─────────────────────────────────────────────────┐
│         Extension Host                          │
│                                                 │
│  MiniInputViewProvider                          │
│    └─ SuggestionCapture                         │
│         └─ DraftDocument (draft.md en memoria)  │
│              ↕ Copilot inline completions        │
│         └─ diff antes/después → texto capturado │
│                                                 │
│  ChatBridge      → workbench.action.chat.open   │
│  ConversationLog → conversation.md (prompts)    │
│  SuggestionLog   → suggestions.md (aceptadas)   │
└─────────────────────────────────────────────────┘
```

---

## Flujo paso a paso

```
[Usuario escribe en el textarea del webview]
          ↓
[debounce 300 ms sin nuevas pulsaciones]
          ↓
[postMessage { type: 'suggest', text } → extension host]
          ↓
[DraftDocument.sync(text) → WorkspaceEdit escribe texto en draft.md]
          ↓
[SuggestionCapture.capture()]
    1. showTextDocument(draft, { preserveFocus: false, preview: true })
    2. editor.action.inlineSuggest.trigger  (espera ~200 ms)
    3. snapshot = document.getText()  ← antes del commit
    4. editor.action.inlineSuggest.commit
    5. committed = document.getText()  ← después del commit
    6. suggestion = committed.slice(snapshot.length)  ← diff
    7. DraftDocument.revert(text)  ← restaurar solo el input del usuario
    8. refocus webview (preserveFocus ya lo gestiona al cerrar el editor temporal)
          ↓
[postMessage { type: 'suggestion', text: suggestion } → webview]
          ↓
[webview muestra ghost-text sobre el textarea]
          ↓
     ┌────┴────────────────────────────────┐
     │ Tab (aceptar)    │ Sigue escribiendo │
     ↓                  ↓                  │
[texto aceptado]   [debounce reset,        │
[appendLog         suggestion descartada]  │
 suggestions.md]                           │
     ↓
[Enter / Enviar]
     ↓
[ChatBridge.send(textoCompleto)]
[ConversationLog.append(textoCompleto)]
[postMessage { type: 'clear' }]
```

---

## Gestión de sugerencias obsoletas

Una sugerencia es **obsoleta** si el usuario ha pulsado cualquier tecla desde que se
lanzó el ciclo de captura. La lógica de debounce en el webview cancela el ciclo antes
de que llegue al host si detecta input nuevo. Si el ciclo ya está en vuelo cuando llega
nuevo input, el host lo ignora (la respuesta `{ type: 'suggestion' }` llega pero el
webview la descarta porque su estado interno tiene un `pendingCaptureId` distinto al
de la respuesta).

```
webview: cada vez que envía 'suggest' incrementa captureId
host: responde con { type: 'suggestion', captureId }
webview: solo acepta la suggestion si captureId === currentCaptureId
```

---

## Componentes nuevos / modificados

| Componente                     | Acción    | Responsabilidad                                                  |
| ------------------------------ | --------- | ---------------------------------------------------------------- |
| `src/DraftDocument.ts`         | **NUEVO** | Abre y gestiona `Docs/draft.md`; sync y revert vía WorkspaceEdit |
| `src/SuggestionCapture.ts`     | **NUEVO** | Ciclo trigger → commit → diff → revert; devuelve string          |
| `src/SuggestionLog.ts`         | **NUEVO** | Append a `Docs/suggestions.md` (sugerencias aceptadas)           |
| `src/MiniInputViewProvider.ts` | MODIFICAR | Manejar mensaje `suggest`; orquestar captura y respuesta         |
| `webview/main.js`              | MODIFICAR | Debounce + captureId; mostrar ghost-text; Tab para aceptar       |
| `webview/index.html`           | MODIFICAR | Añadir elemento `#suggestion-overlay` sobre el textarea          |
| `webview/style.css`            | MODIFICAR | Estilos del ghost-text (color tenue, mismo font que textarea)    |

Componentes **sin cambios**: `ChatBridge.ts`, `ConversationLog.ts`, `extension.ts`,
`package.json`, `tsconfig.json`.

---

## Archivos de datos

Todos los archivos de datos son **internos a la extensión**, almacenados en
`context.storageUri` (o `context.globalStorageUri` como fallback si no hay workspace).
Son invisibles para el usuario y no contaminan ningún proyecto.

| Archivo           | Ubicación     | Propósito                                                           |
| ----------------- | ------------- | ------------------------------------------------------------------- |
| `draft.md`        | `storageUri/` | Buffer de trabajo; se vacía tras cada envío                         |
| `conversation.md` | `storageUri/` | Log de prompts enviados; accesible vía menú en v0.2                 |
| `suggestions.md`  | `storageUri/` | Log de suggestions que el usuario aceptó con Tab; accesible en v0.2 |

---

## Riesgos y mitigaciones

| Riesgo                                              | Mitigación                                              |
| --------------------------------------------------- | ------------------------------------------------------- |
| Copilot no genera suggestion en ese ciclo (~200 ms) | Si el diff es vacío, no se envía ghost-text; sin efecto |
| Flash visual del editor de draft al usuario         | `preserveFocus: true` en showTextDocument               |
| Latencia perceptible (>500 ms)                      | Captura solo tras debounce; el usuario no espera        |
| Copilot cambia su comportamiento de commit          | El diff detectaría string vacío → fallback silencioso   |

---

## Fase de limpieza (obligatoria al finalizar)

Antes de cerrar la iteración, eliminar todo código muerto y residuos del plan C original:

| Ítem                                                                 | Acción                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Comentario `@fileoverview` en `MiniInputViewProvider.ts`             | Actualizar — eliminar referencia a `workbench.panel.chat`                    |
| `Docs/Plans/Option-C--Hybrid-TextEditor-Plus-Positioning.md`         | Mantener como referencia histórica (sin cambios)                             |
| `Docs/Plans/Adopted/Option-C--Hybrid-TextEditor-Plus-Positioning.md` | Actualizar sección Estado: marcar como supersedido por C2                    |
| `Docs/draft.md`                                                      | Debe existir vacío tras cada ciclo; verificar que `.vscodeignore` lo excluye |
| `Docs/suggestions.md`                                                | Verificar que `.vscodeignore` lo excluye del paquete                         |
| Todo `TODO` o comentario temporal                                    | Eliminar antes de validar                                                    |

---

## Estado

> ✅ **Implementado y validado.**
> Todos los archivos de datos migrados a `context.storageUri` / `context.globalStorageUri`.
> `get_errors` + `npm run validate` en verde. Listo para prueba F5.
