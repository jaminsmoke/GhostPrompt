# Option B — Panel WebviewView propio posicionado junto al chat

## Concepto central

No se toca el webview de GitHub Copilot. La extensión crea su propio `WebviewView`
con un editor enriquecido que ofrece **inline suggestions en tiempo real**, y se posiciona
en la misma barra lateral donde vive el chat de Copilot. El usuario escribe en nuestro panel
sin perder de vista el chat oficial, y con un Ctrl+Enter envía el mensaje directamente al chat.

La clave de UX: **cercanía + no cambio de vista + sensación de integración**.

---

## Flujo de trabajo

```
[Usuario abre nuestro panel — posicionado en la misma barra que el chat de Copilot]
          ↓
[Escribe su prompt en el editor enriquecido (Monaco / contenteditable)]
          ↓
[Inline suggestions via vscode.lm en tiempo real → ghost-text como en un editor]
          ↓
[Acepta sugerencia con Tab / completa manualmente]
          ↓
[Ctrl+Enter → workbench.action.chat.open con el query precargado]
          ↓
[El chat oficial de Copilot responde — visible en el panel adyacente]
```

---

## Componentes técnicos

| Componente          | API de VS Code                                                            | Descripción                                                |
| ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Panel de entrada    | `vscode.window.registerWebviewViewProvider`                               | WebviewView posicionable en la barra lateral del chat      |
| Editor enriquecido  | Monaco Editor (WebView)                                                   | Input con ghost-text, historial, plantillas                |
| Inline suggestions  | `vscode.lm.selectChatModels()`                                            | Llamadas al modelo para generar completions en tiempo real |
| Envío al chat       | `vscode.commands.executeCommand('workbench.action.chat.open', { query })` | Dispara el chat oficial con el prompt listo                |
| Historial de drafts | `vscode.ExtensionContext.globalState`                                     | Persiste los prompts enviados                              |

---

## Por qué la incrustación dentro del webview de Copilot no es viable

Los webviews de VS Code son iframes con sandbox de seguridad aislado por origen.
No existe ninguna API pública para inyectar contenido en el webview de otra extensión.
La única vía sería interceptar el proceso de VS Code a nivel de sistema, lo que:

- Viola las políticas de la VS Code Marketplace
- Es más frágil que cualquier otra opción (cualquier refactor interno de Copilot lo rompe)
- Probablemente resultaría en rechazo de la extensión por Microsoft

**El posicionamiento en la misma barra lateral es la alternativa correcta**: VS Code permite
que múltiples vistas convivan en el mismo contenedor de panel, lo que da la percepción visual
de integración sin romper ningún sandbox.

---

## Ventajas

- 100% APIs públicas y estables
- El usuario no cambia de contexto visual — el chat oficial sigue visible al lado
- Control total sobre el input: suggestions, historial, plantillas, atajos
- Resistente a actualizaciones de Copilot (no depende de su internals)
- El valor central (inline ghost-text en el input del chat) es una feature que Copilot no tiene hoy

## Limitaciones

- El usuario sigue teniendo dos áreas de texto (nuestro input + el chat oficial)
- No hay recepción automática de la respuesta del chat en nuestro panel (sin @participant propio)
- Requiere que el usuario descubra y posicione el panel — onboarding necesario

---

## Propuesta de valor comercial

> **Inline ghost-text completions en el input del chat de Copilot** — algo que el panel oficial
> de Copilot no ofrece hoy. La extensión no replica el chat, lo aumenta con la única
> funcionalidad que le falta: asistencia mientras el usuario redacta su prompt.

Es una feature que tiene sentido que Microsoft absorba o que sea objeto de adquisición.
La incrustación es un detalle de UX; el valor central es la asistencia en la redacción del prompt.

---

## Estado

> Opción analizada — pendiente de comparar con Option A y valorar si se adopta una híbrida (Option C)
