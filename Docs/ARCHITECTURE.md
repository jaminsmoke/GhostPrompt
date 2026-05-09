# GhostPrompt — Technical Architecture

> Internal reference document. Describes the design decisions, module structure, data flows and extension points of the `ghost-prompt` VS Code extension.

---

## Table of contents

1. [High-level overview](#1-high-level-overview)
2. [Module map](#2-module-map)
3. [Completion pipeline](#3-completion-pipeline)
4. [Host ↔ Webview message protocol](#4-host--webview-message-protocol)
5. [Data storage](#5-data-storage)
6. [VS Code registration model](#6-vs-code-registration-model)
7. [Key design decisions](#7-key-design-decisions)
8. [Roadmap](#8-roadmap)

---

## 1. High-level overview

```
┌─────────────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                               │
│                                                                 │
│  extension/extension.ts ──► host/MiniInputViewProvider          │
│                        │                                        │
│                        ├──► completion/CopilotCompletion (LM)   │
│                        ├──► bridge/ChatBridge (chat.open cmd)   │
│                        ├──► log/ConversationLog (storageUri)    │
│                        ├──► log/SuggestionLog   (storageUri)    │
│                        └──► session/GhostPromptSessionStore      │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ postMessage / onDidReceiveMessage
┌───────────────────────────▼─────────────────────────────────────┐
│  Webview (isolated renderer — no Node.js access)                │
│                                                                 │
│  index.html  +  main.js  +  style.css                          │
│                                                                 │
│  - Textarea with debounced input listener                       │
│  - Ghost-text div rendered below the textarea                   │
│  - Tab-to-accept / Enter-to-send keyboard handling              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module map

| File                                      | Responsibility                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/extension/extension.ts`              | Entry point. Registers two `WebviewViewProvider` instances (Activity Bar + Panel).                                   |
| `src/host/MiniInputViewProvider.ts`       | Core provider. Sets up the webview, wires the message protocol, delegates to service modules.                        |
| `src/session/GhostPromptSessionStore.ts`  | Shared session state (draft, suggestions, capture id) across Sidebar + Panel.                                       |
| `src/completion/CopilotCompletion.ts`     | Requests a prompt continuation from Copilot via `vscode.lm.selectChatModels` + `sendRequest`. No editor interaction. |
| `src/governor/SuggestionRequestGovernor.ts` | Dedupe, cache, cooldown, rate limit, session budget before hitting the LM.                                           |
| `src/bridge/ChatBridge.ts`                | Sends the final prompt to Copilot Chat via `workbench.action.chat.open`.                                             |
| `src/log/ConversationLog.ts`              | Appends sent prompts to `conversation.md` in `context.storageUri`.                                                   |
| `src/log/SuggestionLog.ts`                | Appends accepted suggestions to `suggestions.md` in `context.storageUri`.                                            |
| `src/debug/SuggestionDebug.ts`            | Debug toggle and optional output channel logging.                                                                   |
| `webview/index.html`           | HTML shell. Uses `{{nonce}}`, `{{cspSource}}`, `{{styleUri}}`, `{{scriptUri}}` template tokens injected at runtime.  |
| `webview/main.js`              | Client-side logic: debounce, captureId, ghost-text, Tab/Enter handlers.                                              |
| `webview/style.css`            | VS Code CSS-variable-based styling. `.ghost-text` uses `--vscode-editorGhostText-foreground`.                        |

---

## 3. Completion pipeline

```
User types in textarea
        │
        ▼
  input event → clearGhost() → debounce 300 ms
        │
        ▼ (after 300 ms of inactivity)
  currentCaptureId += 1
  postMessage { type:'suggest', text, captureId }
        │
        ▼  [Extension Host]
  CopilotCompletion.requestCompletion(userText)
    └── vscode.lm.selectChatModels({ vendor:'copilot' })
    └── model.sendRequest([User(instruction + userText)])
    └── stream response.text chunks → completion string
        │
        ▼
  postMessage { type:'suggestion', suggestion, captureId }
        │
        ▼  [Webview]
  if captureId !== currentCaptureId → discard (stale)
  else → showGhost(suggestion)
        │
        ▼ (user presses Tab)
  input.value += pendingSuggestion
  postMessage { type:'accept', context, suggestion }
  → SuggestionLog.appendSuggestion(storageUri, context, suggestion)
```

### captureId pattern

Each debounce cycle increments `currentCaptureId` (webview-local counter). The host echoes the same `captureId` in its response. The webview discards any response whose `captureId` does not match the latest value — this prevents stale completions from earlier keystrokes from overwriting a newer ghost-text.

---

## 4. Host ↔ Webview message protocol

All messages are plain JSON objects. The webview has no `acquireVsCodeApi` state other than `postMessage`.

### Webview → Host

| `type`    | Payload                                   | Description                                        |
| --------- | ----------------------------------------- | -------------------------------------------------- |
| `suggest` | `{ text: string, captureId: number }`     | Request a completion for the current partial text. |
| `accept`  | `{ context: string, suggestion: string }` | User accepted the ghost-text with Tab.             |
| `send`    | `{ text: string }`                        | User pressed Enter — send prompt to Copilot Chat.  |

### Host → Webview

| `type`       | Payload                                     | Description                                           |
| ------------ | ------------------------------------------- | ----------------------------------------------------- |
| `suggestion` | `{ suggestion: string, captureId: number }` | Completion result. Discarded if `captureId` is stale. |
| `clear`      | —                                           | Reset the input after a successful send.              |

---

## 5. Data storage

All data files live in the extension's private storage, never in the user's workspace.

| File              | Location             | Content                                                           |
| ----------------- | -------------------- | ----------------------------------------------------------------- |
| `conversation.md` | `context.storageUri` | Timestamped log of every prompt sent to Copilot Chat.             |
| `suggestions.md`  | `context.storageUri` | Timestamped log of every ghost-text suggestion accepted with Tab. |

`storageUri` requires an open workspace. If none is open, both logs fall back to `context.globalStorageUri` (always available).

```ts
const dataUri = storageUri ?? globalStorageUri;
```

Both log modules call `vscode.workspace.fs.createDirectory(storageUri)` before every write to guarantee the directory exists.

---

## 6. VS Code registration model

The extension declares two `viewsContainers` — one in `activitybar` and one in `panel` — and one `views` entry per container, both pointing to webview type.

```json
"viewsContainers": {
  "activitybar": [{ "id": "inlineChatInput", "icon": "media/icon.svg" }],
  "panel":       [{ "id": "inlineChatInputPanel", "icon": "media/icon.svg" }]
},
"views": {
  "inlineChatInput":      [{ "type": "webview", "id": "inlineChatInput.miniInput" }],
  "inlineChatInputPanel": [{ "type": "webview", "id": "inlineChatInput.miniInputPanel" }]
}
```

Two separate `MiniInputViewProvider` instances are registered (one per view ID) in `extension/extension.ts`. Both share the same `ExtensionContext`, so they write to the same `storageUri`.

The icon **must be an SVG file path** — codicon token strings (`$(chat)`) are not accepted in `viewsContainers`.

---

## 7. Key design decisions

### Why `vscode.lm` instead of inline suggest commands?

The original implementation used `showTextDocument` + `editor.action.inlineSuggest.trigger/commit` on a hidden `draft.md` file. This caused two critical UX bugs:

1. `draft.md` was opened as a visible editor tab.
2. `showTextDocument` with `preserveFocus: false` stole keyboard focus from the webview on every keystroke.

`vscode.lm.selectChatModels` + `sendRequest` is a fully programmatic API with no UI side-effects. It requires only that Copilot is installed and signed in. The `draft.md` and `DraftDocument.ts` / `SuggestionCapture.ts` modules were removed entirely.

### Why two view containers instead of anchoring to `workbench.panel.chat`?

`workbench.panel.chat` is VS Code core-internal and is not an extension point. Third-party extensions cannot register views inside it. The dual `viewsContainers` approach (Activity Bar + Panel) is the correct and supported model.

### Why `storageUri ?? globalStorageUri`?

`context.storageUri` is `undefined` when no folder/workspace is open. `globalStorageUri` is always defined. The fallback ensures the extension works in a windowless or folder-less VS Code session.

---

## 8. Roadmap

### v0.2 — History UI

- Expose `conversation.md` and `suggestions.md` from `storageUri` via a tree view or webview panel inside the Activity Bar container.
- Allow the user to re-send past prompts from the history view.

### v0.3 — UX polish

- Configurable debounce delay (`promptAssistant.debounceMs`).
- Configurable model selection (`promptAssistant.model`).
- Multi-sentence completion mode.
- Keyboard shortcut to focus the mini-input from anywhere in VS Code.

### v1.0 — Marketplace release

- Full test suite (unit + integration with `@vscode/test-electron`).
- CHANGELOG.md + semantic versioning.
- Publisher registration and `vsce package` / `vsce publish` pipeline.
