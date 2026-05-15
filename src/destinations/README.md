# `destinations/` — Destinos de prompt

> Dominio canónico que gestiona dónde se envía el prompt final del usuario.

---

## Rol

`destinations/` implementa el patrón **`DestinationProvider`**. Cada destino expone cómo enviar el prompt final (Copilot Chat, VSOpenCodeX) y se registra en el `destinationRegistry`. El destino activo se resuelve via `ghostPrompt.agentDestination` o auto-detección si VSOpenCodeX está instalada.

**Diferencia clave con `engines/`:**

- `engines/` = **motor de suggestion** (genera ghost-text continuations)
- `destinations/` = **destino del prompt** (dónde se envía el texto final del usuario)

---

## Estructura

```
destinations/
├── destinationRegistry.ts        # Registro de destinos + getActiveDestinationProvider
├── copilotChat/
│   └── copilotChatDestination.ts # Envía prompt a Copilot Chat (vscode.commands.executeCommand)
└── vsOpenCodeX/
    └── vsOpenCodeXDestination.ts # Forward UI a VSOpenCodeX + notify si no instalada
```

---

## Patrón `DestinationProvider`

```ts
interface DestinationProvider {
  id: 'copilotChat' | 'vsOpenCodeX';
  sendPrompt?: (text: string) => Promise<void>;
}
```

### Registro

```ts
registerDestination("copilotChat", { id: "copilotChat", sendPrompt: ... });
registerDestination("vsOpenCodeX", { id: "vsOpenCodeX", sendPrompt: ... });
```

### Resolución

```ts
getActiveDestinationProvider(); // → provider del destino activo
getGhostPromptAgentDestination(); // → "copilotChat" | "vsOpenCodeX"
```

---

## Destinos

### Copilot Chat (`copilotChat/`)

- **Acción:** Abre el panel de Copilot Chat y envía el prompt
- **Implementación:** `vscode.commands.executeCommand("workbench.action.chat.open")` + insert text
- **Default:** Si no hay VSOpenCodeX instalada o `agentDestination` nunca fue configurado

### VSOpenCodeX (`vsOpenCodeX/`)

- **Acción:** Forward del UI inline a la extensión VSOpenCodeX
- **Comandos:**
  - `vsopencodex.ghostPromptInlineUi` — recibe el UI de GhostPrompt
  - `ghostPrompt.runSuggestPipeline` — VSOpenCodeX puede disparar el pipeline
- **Auto-detección:** Si VSOpenCodeX está instalada y `agentDestination` nunca fue guardado, el efectivo es `vsOpenCodeX`
- **Notificación:** Si el destino es `vsOpenCodeX` pero la extensión no está cargada, muestra un hint (una vez por sesión)

---

## Matriz motor/destino

| Motor      | Destino      | Comportamiento                                 |
| ---------- | ------------ | ---------------------------------------------- |
| Copilot LM | Copilot Chat | Suggestion + send a Copilot Chat               |
| Copilot LM | VSOpenCodeX  | Suggestion via VSOpenCodeX, send a VSOpenCodeX |
| OpenCode   | Copilot Chat | Suggestion via OpenCode, send a Copilot Chat   |
| OpenCode   | VSOpenCodeX  | Suggestion via OpenCode, send a VSOpenCodeX    |
| Ollama     | Copilot Chat | Suggestion via Ollama, send a Copilot Chat     |
| Ollama     | VSOpenCodeX  | Suggestion via Ollama, send a VSOpenCodeX      |

---

## Dependencias

| Importa de | Por qué                  |
| ---------- | ------------------------ |
| `vscode`   | Commands, extensions API |

**No importa de:** `host/`, `api/`, `sugcore/` (los destinos son independientes del pipeline)

---

## Tests relevantes

| Test                             | Qué cubre                                      |
| -------------------------------- | ---------------------------------------------- |
| `destinationRegistry.test.ts`    | Registro y resolución de destinos              |
| `copilotChatDestination.test.ts` | Envío de prompt a Copilot Chat                 |
| `vsOpenCodeXDestination.test.ts` | Forward UI, notify si VSOpenCodeX no instalada |
