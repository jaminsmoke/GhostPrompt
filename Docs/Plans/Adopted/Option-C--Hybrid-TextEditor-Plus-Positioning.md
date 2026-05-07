# Option C — Híbrida: Mini-input WebviewView anclado al panel del chat

## Concepto central

**No se emula el chat de Copilot**. El chat oficial sigue siendo el chat oficial —
respuestas, historial, todo. Lo único que aporta la extensión es un **mini-input propio**,
un contenedor pequeño con un editor enriquecido que sustituye funcionalmente solo al input
nativo del chat, y que se posiciona lo más cerca posible de él.

La clave: el usuario escribe en nuestro mini-input (con inline suggestions nativas de Copilot),
pulsa Enter, y el mensaje llega al chat oficial como si lo hubiera escrito allí directamente.
**El chat oficial responde exactamente igual que siempre.**

---

## Insight clave

> Las inline suggestions de GitHub Copilot en archivos `.md` son 100% nativas y gratuitas.
> No hace falta implementar ninguna llamada a `vscode.lm` para las completions del input —
> Copilot ya las hace en cualquier TextEditor. El trabajo de la extensión es el **puente**
> (envío al chat) y el **posicionamiento** (cercanía visual), no la generación de suggestions.

---

## Arquitectura

```
┌──────────────────────────────────────────────┐
│         Panel del chat de Copilot            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │   Historial de conversación (oficial)  │  │
│  │   [Respuestas de Copilot aquí]         │  │
│  │   [sin tocar, sin modificar]           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │  ← nuestra WebviewView
│  │  ✏  Escribe tu prompt...               │  │     contribuida al mismo
│  │     _ghost text inline de Copilot_     │  │     contenedor del chat
│  │                          [Enviar ↵]    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [──── Input original de Copilot (oculto/    │
│         reemplazado visualmente) ────────]   │
└──────────────────────────────────────────────┘
```

---

## Posicionamiento: contribuir al contenedor del chat de Copilot

**✅ Verificado** — El ID del contenedor del chat de Copilot es `workbench.panel.chat`,
confirmado inspeccionando el `package.json` de la extensión bundleada (v0.47.0).
Este es un contenedor **built-in de VS Code**, lo que significa que cualquier extensión
puede contribuir vistas a él sin restricciones de sandbox entre extensiones.

En `package.json` de la extensión:

```json
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
```

Nuestra vista aparece **dentro del mismo panel** que el chat de Copilot.
El orden de registro determina si queda encima o debajo del input nativo.

### Posicionamiento: encima del input nativo ✅ (opción elegida)

| Opción                      | Cómo                                      | Valoración                                                 |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| **Encima del input nativo** | Primera vista registrada en el contenedor | ✅ Natural — el usuario redacta arriba, ve respuestas abajo |
| Debajo del input nativo     | Última vista registrada                   | ⚠️ Dos inputs superpuestos, el inferior queda más oculto    |
| Reemplazar visualmente      | No hay API para ocultar el input nativo   | ❌ No viable sin reverse engineering                        |

El flujo de lectura de arriba a abajo hace que **encima** sea la posición más intuitiva:
el usuario ve nuestro mini-input primero, escribe con suggestions, envía, y la respuesta
aparece en el historial de Copilot debajo.

---

## Flujo de trabajo

```
[Extensión activa → nuestra WebviewView aparece en el panel del chat de Copilot]
          ↓
[Usuario escribe en el mini-input de nuestra vista]
          ↓
[Inline suggestions nativas de Copilot actúan sobre el TextDocument subyacente]
          ↓
[Ghost-text visible en el mini-input → Tab para aceptar]
          ↓
[Enter / botón Enviar → workbench.action.chat.open con el query]
          ↓
[El chat oficial de Copilot recibe el mensaje y responde como siempre]
```

---

## Componentes técnicos

| Componente               | API de VS Code                                                            | Descripción                                               |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Mini-input view          | `vscode.window.registerWebviewViewProvider`                               | Vista mínima: solo el área de input enriquecido           |
| Contribución al panel    | `contributes.views["copilot.chat"]` en `package.json`                     | Ancla la vista dentro del contenedor del chat oficial     |
| Inline suggestions       | **Nativas de Copilot** sobre `conversation.md`                            | El TextDocument subyacente las recibe gratis              |
| Sincronización input↔.md | `vscode.workspace.openTextDocument` + eventos del webview                 | Lo que se escribe en el mini-input se refleja en el `.md` |
| Envío al chat            | `vscode.commands.executeCommand('workbench.action.chat.open', { query })` | Dispara el chat oficial con el prompt                     |
| Historial                | Appendado al `conversation.md`                                            | El `.md` actúa como log persistente de prompts enviados   |

---

## Ventajas sobre A y B

|                                        | Option A | Option B            | **Option C**    |
| -------------------------------------- | -------- | ------------------- | --------------- |
| Suggestions nativas de Copilot         | ✅        | ❌ (requiere LM API) | ✅               |
| Sin cambio de vista / cercanía al chat | ❌        | ✅                   | ✅ (mismo panel) |
| Solo reemplaza el input, no el chat    | ❌        | ❌                   | ✅               |
| Control sobre el input                 | Parcial  | ✅                   | ✅               |
| Complejidad de implementación          | Baja     | Media               | Media-baja      |
| Persistencia de historial en `.md`     | ✅        | ❌                   | ✅               |
| Resistente a cambios de Copilot        | ✅        | ✅                   | ✅               |

---

## Riesgo residual

El ID `workbench.panel.chat` está confirmado, pero VS Code podría en el futuro
restringir contribuciones externas a contenedores built-in. La probabilidad es baja
(sería un breaking change para múltiples extensiones del ecosistema), pero si ocurriera,
el fallback inmediato es registrar la vista en la activity bar lateral — funcionalidad
idéntica, percepción visual algo menos integrada pero igualmente válida para el MVP.

---

## Propuesta de valor

> El usuario nunca abandona la vista del chat de Copilot mientras redacta.
> Las suggestions de Copilot están disponibles en el input de forma nativa.
> La extensión es un puente invisible: posiciona, sugiere, y envía.

---

## Estado

> ⚠️ **Supersedido por Option C2.**
> El contenedor `workbench.panel.chat` resultó ser un punto de extensión interno de VS Code
> no accesible en runtime. El posicionamiento se resolvió con activity bar + panel inferior.
> La captura de suggestions se reimplementó en **C2** (`Docs/Plans/Adopted/Option-C2--Draft-Document-Suggestions.md`).
> Este documento se conserva como referencia histórica del razonamiento original.
