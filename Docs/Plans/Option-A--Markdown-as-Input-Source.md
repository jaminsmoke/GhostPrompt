# Option A — Markdown como fuente de entrada (flujo invertido)

## Concepto central

En lugar de intentar espejear el chat hacia un markdown (bloqueado por la API cerrada de Copilot),
**el markdown es el origen**: el usuario redacta y refina su prompt directamente en `conversation.md`,
aprovecha las inline suggestions de GitHub Copilot en ese archivo, y luego lo envía al chat.

---

## Flujo de trabajo

```
[Usuario escribe en conversation.md]
          ↓
[InlineCompletionProvider sugiere en tiempo real dentro del .md]
          ↓
[Usuario acepta la sugerencia y completa su mensaje]
          ↓
[Keybinding / comando de la extensión (Ctrl+Enter)]
          ↓
[workbench.action.chat.open → abre/enfoca el chat con el query precargado]
          ↓
[Respuesta del chat — manual o via @participant propio → se escribe de vuelta al .md]
```

---

## Componentes técnicos

| Componente                        | API de VS Code                                                            | Descripción                                                        |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Archivo `conversation.md`         | `vscode.workspace.fs`                                                     | Se crea al instalar/activar la extensión si no existe              |
| Sugerencias en el markdown        | `vscode.languages.registerInlineCompletionItemProvider`                   | Completions en tiempo real mientras el usuario escribe             |
| Envío al chat                     | `vscode.commands.executeCommand('workbench.action.chat.open', { query })` | Abre el panel del chat con el contenido del .md precargado         |
| Recepción de respuesta (opcional) | `vscode.chat.createChatParticipant` + `vscode.lm.selectChatModels()`      | Un `@participant` propio que escribe la respuesta de vuelta al .md |
| Watcher del archivo               | `vscode.workspace.createFileSystemWatcher`                                | Detecta cambios en el .md para mantener estado                     |

---

## Ventajas

- 100% realizable con APIs públicas y estables de VS Code
- No depende de reverse engineering del webview del chat
- Las inline suggestions de GitHub Copilot en `.md` funcionan de forma nativa
- El historial de la conversación queda persistido en el markdown
- Resistente a actualizaciones de VS Code / Copilot

## Limitaciones

- El usuario cambia de contexto (del chat al .md y viceversa) — no es flujo unificado
- No hay espejo en tiempo real del input del chat; el markdown es el editor principal
- La respuesta del chat requiere un `@participant` propio para escribirse de vuelta automáticamente

---

## Variante con Chat Participant propio

Con `vscode.chat.createChatParticipant` se puede crear un participante `@draft` o `@compose` que:

1. Toma el contenido actual del `conversation.md`
2. Lo envía a `vscode.lm.selectChatModels()` (acceso a Copilot/GPT-4o)
3. Devuelve la respuesta en el propio panel del chat
4. Opcionalmente, guarda la respuesta en el markdown para mantener historial

Esto convierte la experiencia en un **chat completo dentro del panel de Copilot**, donde el input
se redacta con asistencia en el markdown y el output fluye de vuelta al archivo.

---

## Estado

> Opción analizada — pendiente de comparar con Option B antes de decidir arquitectura
