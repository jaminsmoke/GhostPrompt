# GhostPrompt — Technical Architecture

> Internal reference document. Describes the design decisions, module structure, data flows and extension points of the `ghost-prompt` VS Code extension.
>
> **Layer ownership & refactor phases:** see [`Owners.md`](./Owners.md) (matrix, `src`↔tests map, phase gates).

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
│                        ├──► completion: CompletionProvider      │
│                        │      (Copilot LM | OpenCode por fuente) │
│                        ├──► host/handleGhostPromptSuggest        │
│                        │      (gobernador + LM enrutado + UI)    │
│                        ├──► opencode/* (runtime embebido, warm) │
│                        ├──► bridge/ChatBridge (chat.open cmd)   │
│                        ├──► log/ConversationLog (storageUri)    │
│                        ├──► log/SuggestionLog   (storageUri)    │
│                        ├──► projectMemory/* (globalStorageUri)   │
│                        └──► session/GhostPromptSessionStore      │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ postMessage / onDidReceiveMessage
┌───────────────────────────▼─────────────────────────────────────┐
│  Webview (isolated renderer — no Node.js access)                │
│                                                                 │
│  index.html + style.css + bundle (p. ej. webview/dist/main.js)  │
│                                                                 │
│  - Debounced input; captureId; ghost-text                        │
│  - Tab-to-accept / Enter-to-send                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module map

| Location | Responsibility |
| -------- | -------------- |
| `src/extension/extension.ts` | Entry point: commands, configuration listeners, two `WebviewViewProvider` registrations, `deactivate` (invalida caché OpenCode / pool sesión / cola LM). |
| `src/host/MiniInputViewProvider.ts` | Webview HTML/CSP, broadcast a Sidebar+Panel, delegación a handlers y warm OpenCode. |
| `src/host/handleGhostPromptSuggest.ts` | Orquesta `suggest`: gobernador, memoria proyecto (si aplica), `getCompletionProviderForSource` + routing de modelo, loading/stream final. |
| `src/host/webviewProtocols.ts` | Parseo Zod de mensajes webview→host; validación de sobre `settings` host→webview. |
| `src/shared/webviewMessageSchemas.ts` | Schemas Zod canónicos host ↔ webview (también consumidos por el bundle webview en build). |
| `src/session/GhostPromptSessionStore.ts` | Estado compartido (borrador, suggestions, `activeCaptureId`, token de cancelación del intento activo). |
| `src/completion/completionProvider.ts` | Registro `CompletionProvider`; `getCompletionProviderForSource`, `getActiveCompletionProvider`, `getCompletionProviderKind`. |
| `src/completion/completionSources.ts` | `enabledCompletionSources` vs legacy `completionProvider`; `resolveCompletionSourceForRequest` (p. ej. `provider/model` → OpenCode). |
| `src/completion/catalog/*` | Catálogo Copilot (`modelCatalog`), OpenCode (`opencodeModelCatalog`), merge multi-fuente (`mergedModelCatalog`), tiers y normalización de `models`. |
| `src/completion/context/projectBootstrapContext.ts` | README/package bootstrap para `contextMode: project`. |
| `src/completion/providers/copilotLmCompletion.ts` | Adaptador Copilot: `vscode.lm.selectChatModels` + `sendRequest`. |
| `src/completion/providers/opencodeLmCompletion.ts` | Adaptador OpenCode: runtime, snapshot `config.providers()`, sesión inline pooled, `prompt`, SSE opcional, cola serie LM. |
| `src/completion/index.ts` | Barrel: tipos, instrucción, reexports desde `catalog/` y `context/`; alias `requestCompletion` → solo Copilot (legacy). |
| `src/opencode/*` | Proceso embebido, SDK, CLI, streams SSE, caché de proveedores, sesión inline, cola de completions. |
| `src/governor/SuggestionRequestGovernor.ts` | Dedupe, cache, cooldown, rate limit, presupuesto antes del LM. |
| `src/bridge/ChatBridge.ts` | Envía el prompt final a Copilot Chat (`workbench.action.chat.open`). |
| `src/log/ConversationLog.ts` | `conversation.md` bajo `storageUri`. |
| `src/log/SuggestionLog.ts` | `suggestions.md` bajo `storageUri`. |
| `src/projectMemory/*` | Store JSON por carpeta, reconcile, ingest, watchers opcionales. |
| `src/debug/SuggestionDebug.ts` | Toggle debug y canal **GhostPrompt Suggestions** (`[opencode-perf]` cuando aplica). |
| `webview/index.html` | Shell HTML; tokens `{{nonce}}`, CSP, URIs de script/estilo inyectados en runtime. |
| `webview/dist/main.js` (build) | Bundle generado desde `webview/src` (`npm run build:webview`); es el script que carga la vista. |
| `webview/style.css` | Estilos basados en variables VS Code; ghost text. |

---

## 3. Completion pipeline

```
User types in textarea
        │
        ▼
  input → debounce (webview) → increment captureId
  postMessage { type:'suggest', text, captureId }
        │
        ▼  [Extension Host]
  parseWebviewInboundMessage → handleGhostPromptSuggest
    └── SuggestionRequestGovernor.decide (cache / cooldown / block / serve-cache)
    └── resolveCompletionSourceForRequest(selectedModelId, enabledSources)
    └── getCompletionProviderForSource(copilot | opencode).requestCompletion(...)
          ├── Copilot: vscode.lm … sendRequest → texto
          └── OpenCode: runtime.start → providers snapshot → sesión pooled →
              session.prompt; opcional consumeOpencodeSuggestionTextStream (preview SSE)
    └── postMessage loading / suggestion-stream (OpenCode) / suggestion | empty | error
        │
        ▼  [Webview]
  Si captureId ≠ activo → descartar (stale)
  Si suggestion → showGhost
        │
        ▼ (Tab)
  postMessage { type:'accept', ... } → SuggestionLog
```

**Multi-fuente:** si `ghostPrompt.enabledCompletionSources` incluye copilot y opencode, el modelo elegido en el selector determina el motor (`providerID/modelID` → OpenCode; id de chat Copilot → LM). Con fuente única no configurada, se usa el legacy `ghostPrompt.completionProvider`.

### captureId pattern

Each debounce cycle increments `currentCaptureId` (webview-local counter). The host echoes the same `captureId` in its response. The webview discards any response whose `captureId` does not match the latest value — this prevents stale completions from earlier keystrokes from overwriting a newer ghost-text.

---

## 4. Host ↔ Webview message protocol

Los mensajes son JSON. Contratos **Zod** en `src/shared/webviewMessageSchemas.ts`; el host valida entrada con `parseWebviewInboundMessage` (`webviewProtocols.ts`). El cliente webview empaqueta la misma forma en el bundle.

### Webview → Host (resumen)

| `type` | Rol |
| ------ | --- |
| `init` | Primera carga de la vista. |
| `suggest` | `{ text, captureId }` — pedir suggestion. |
| `draftChanged` | Sincronizar borrador entre vistas (`originViewId`). |
| `accept` / `send` | Tab en ghost-text / Enter para chat. |
| `updateSetting` | Cambios desde chips (política, modelo, estilo, contexto, idioma, debug, `completionProvider`, …). |

### Host → Webview (resumen)

| `type` | Rol |
| ------ | --- |
| `settings` | Payload completo de UI (modelos, motor, `completionUiKind`, …). |
| `loading` | Fase de carga (`phase`, `statusText`, `captureId`); incluye fases OpenCode/Copilot. |
| `suggestion-stream` | OpenCode: texto acumulado por SSE antes del resultado final (`captureId`). |
| `suggestion` / `empty` / `error` | Resultado del intento (`captureId`). |
| `languageEffective` | Idioma efectivo resuelto para la suggestion. |
| `draftSync` / `draftHydrate` | Estado de borrador entre Sidebar y Panel. |
| `clear` | Tras envío exitoso al chat. |

Lista exhaustiva y campos: código fuente + tests `webviewProtocols.test.ts`.

---

## 5. Data storage

User-facing logs and project-memory JSON live in **extension private storage**, not inside the opened repository (unless the user explicitly mirrors paths elsewhere — GhostPrompt does not write memory JSON into the workspace root).

### Conversation and suggestion logs

| File              | Location             | Content                                                           |
| ----------------- | -------------------- | ----------------------------------------------------------------- |
| `conversation.md` | `context.storageUri` | Timestamped log of every prompt sent to Copilot Chat.             |
| `suggestions.md`  | `context.storageUri` | Timestamped log of every ghost-text suggestion accepted with Tab. |

`storageUri` requires an open workspace. If none is open, both logs fall back to `context.globalStorageUri` (always available).

```ts
const dataUri = storageUri ?? globalStorageUri;
```

Both log modules call `vscode.workspace.fs.createDirectory(storageUri)` before every write to guarantee the directory exists.

### Project memory (v0.4)

When **`ghostPrompt.projectMemoryEnabled`** is on and **`ghostPrompt.contextMode`** is **`project`**, the suggest path **reconciles** excerpts from disk into a per-workspace-folder store, then merges reconciled lines into the LM instruction (alongside existing volatile project context).

| Path (relative to `ExtensionContext.globalStorageUri`) | Content |
| ------------------------------------------------------- | ------- |
| `ghostPrompt/projectMemory/v1/registry.json` | Workspace keys (`workspaceKey`), relative store folder name, `lastSeenAt` for whole-store GC. |
| `ghostPrompt/projectMemory/v1/stores/<sha256>/manifest.json` | Schema version and store metadata. |
| `ghostPrompt/projectMemory/v1/stores/<sha256>/entries.json` | Bootstrap rows (`README*`, `package.json`, …) and optional **editor-ingest** rows; LRU fields; mtime/hash for invalidation. |

**Multi-root:** one store directory per `WorkspaceFolder`; the active document’s workspace root selects which store participates in a given suggestion.

**Hygiene:** unused store folders are deleted after **`ghostPrompt.projectMemoryUnusedStoreTtlDays`** (default 30). Optional **`FileSystemWatcher`** instances watch only paths that appear in `entries.json` (throttled); disable via **`ghostPrompt.projectMemoryFileWatcherEnabled`**.

---

## 6. VS Code registration model

The extension declares two `viewsContainers` — Activity Bar + Panel — each with a webview view (IDs **`ghostPrompt.input`** and **`ghostPrompt.inputPanel`**; containers **`ghostPrompt`** / **`ghostPromptPanel`**). Ver `package.json` → `contributes`.

Two `MiniInputViewProvider` instances are registered in `extension/extension.ts`. Share `ExtensionContext` and storage.

The icon **must be an SVG file path** — codicon token strings (`$(chat)`) are not accepted in `viewsContainers`.

---

## 7. Key design decisions

### Why `vscode.lm` instead of inline suggest commands?

The original implementation used `showTextDocument` + `editor.action.inlineSuggest.trigger/commit` on a hidden `draft.md` file. This caused two critical UX bugs:

1. `draft.md` was opened as a visible editor tab.
2. `showTextDocument` with `preserveFocus: false` stole keyboard focus from the webview on every keystroke.

`vscode.lm.selectChatModels` + `sendRequest` is a fully programmatic API with no UI side-effects. It requires only that Copilot is installed and signed in. The `draft.md` and `DraftDocument.ts` / `SuggestionCapture.ts` modules were removed entirely.

### Why OpenCode as a second backend?

Optional path **`ghostPrompt.completionProvider`** / **`enabledCompletionSources`** routes to an **embedded OpenCode server** (CLI + `@opencode-ai/sdk`) so suggestions can use the user’s OpenCode models and providers. Latency is higher than Copilot LM (extra process + HTTP/SSE); GhostPrompt mitigates with provider snapshot cache, pooled session, serialized LM queue, and debug `[opencode-perf]` lines. See [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md).

### Why two view containers instead of anchoring to `workbench.panel.chat`?

`workbench.panel.chat` is VS Code core-internal and is not an extension point. Third-party extensions cannot register views inside it. The dual `viewsContainers` approach (Activity Bar + Panel) is the correct and supported model.

### Why `storageUri ?? globalStorageUri`?

`context.storageUri` is `undefined` when no folder/workspace is open. `globalStorageUri` is always defined. The fallback ensures the extension works in a windowless or folder-less VS Code session.

---

## 8. Roadmap

### v0.4 — Project memory + OpenCode perf (shipped / doc)

- **Project memory:** per-workspace-folder JSON under `globalStorageUri/ghostPrompt/projectMemory/v1/` — [`Roadmap-v0.4-project-context-store.md`](./Plans/Roadmaps/Roadmap-v0.4-project-context-store.md).
- **OpenCode:** catalog cache, pooled inline session, debug perf logs, serialized LM queue — [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md).
- **Maintainability:** layer ownership — [`Owners.md`](./Owners.md).

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
