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

```text
┌─────────────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                               │
│                                                                 │
│  extension/extension.ts ──► vscode/MiniInputViewProvider        │
│                        │                                        │
│                        ├──► core/suggest: suggest pipeline      │
│                        │      (Copilot LM | OpenCode | Ollama)   │
│                        ├──► api/boundary: inbound + Zod parse     │
│                        ├──► api/settings: settings postMessage  │
│                        ├──► system/internals/config: read/write │
│                        ├──► engines/opencode/* (API client + catalog) │
│                        ├──► destinations/ (chat.open cmd)       │
│                        ├──► system/log/ConversationLog.ts (storageUri)  │
│                        ├──► system/log/SuggestionLog.ts   (storageUri)  │
│                        ├──► core/memory/* (project memory JSON, ingest, opcional) │
│                        └──► core/state/GhostPromptSessionStore      │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ postMessage / onDidReceiveMessage
┌───────────────────────────▼─────────────────────────────────────┐
│  Webview (isolated renderer — no Node.js access)                │
│                                                                 │
│  src/ui/webview/dist/react/index.html + bundle React (Vite)       │
│                                                                 │
│  - Debounced input; captureId; ghost-text                        │
│  - Tab-to-accept / Enter-to-send                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module map

| Location                                           | Responsibility                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension/extension.ts`                       | Entry point: commands, configuration listeners, two `WebviewViewProvider` registrations, `deactivate` (resetea client OpenCode).                                                                                                                            |
| `src/vscode/MiniInputViewProvider.ts`              | Webview HTML/CSP, broadcast a Sidebar+Panel, delegación a handlers.                                                                                                                                                                                         |
| `src/vscode/webviewHtml.ts`                        | HTML template generation, CSP nonce, secure URI substitution.                                                                                                                                                                                               |
| `src/vscode/suggestionNotification.ts`             | Non-intrusive `vscode.window.showWarningMessage` for actionable suggestion failures.                                                                                                                                                                        |
| `src/api/boundary/webviewProtocols.ts`             | Zod parseo de mensajes webview→host; validación de sobre `settings` host→webview (con logging).                                                                                                                                                              |
| `src/api/boundary/inboundHandlers.ts`              | Router/dispatch de mensajes inbound (`init`, `suggest`, `send`, `accept`, `draftChanged`, `updateSetting`).                                                                                                                                                 |
| `src/api/settings/settingsPostMessage.ts`          | Construye y envía el mensaje `settings` al webview (lista de modelos, chips, etc.).                                                                                                                                                                         |
| `src/system/internals/config/write/applyWebviewUpdateSetting.ts` | Aplica `updateSetting` vía `vscode.workspace`.                                                                                                                                                                                              |
| `src/system/internals/config/read/`                | Lectores de `ghostPrompt.*` (modelo, style, Ollama, contexto editor). Destino agente → `destinations/`.                                                                                                                                                     |
| `src/core/`                                        | Dominio suggestion: tipos (`contracts/`), `prompt/`, `streaming/`, `language/`, `presentation/` (fases de carga), `routing/sources`, `state/`, `memory/` (persistencia + bootstrap README/package), `suggest/`. Catálogo merged y registry LM → `engines/`. |
| `src/core/suggest/runSuggest.ts`                   | Orquestación del `suggest`: umbral mínimo de texto (`trim`), sesión/cancelación, routing de fuente → `engines` → fases `loading` → broadcast UI.                                                                                                            |
| `src/core/state/GhostPromptSessionStore.ts`        | Estado compartido (borrador, suggestions, `activeCaptureId`, token de cancelación).                                                                                                                                                                         |
| `src/core/memory/projectBootstrapContext.ts`       | Card bootstrap proyecto (README / `package.json`) para modo proyecto; compartido con ingest/persist de memoria.                                                                                                                                             |
| `src/system/policies/SuggestionRequestGovernor.ts` | **Legacy** (cache / cooldown / bloqueo); **no** invocado por `runSuggest`; cubierto por `SuggestionRequestGovernor.test.ts`.                                                                                                                                |
| `src/engines/`                                     | Motores de completion canónicos. `copilot/`, `opencode/` (apiClient + catalog), `ollama/`, `engineRegistry.ts`, `config/completionSources.ts` (fuentes habilitadas), `routing/resolveCompletionSource.ts` (modelo → motor).                                                                                                                                           |
| `src/destinations/`                                | Destinos de prompt. `copilotChat/` (`sendToChat`), `vsOpenCodeX/` (forward UI, notify missing).                                                                                                                                                             |
| `src/system/internals/protocols/validations/schemas/zschemWebviewMessages.ts` | Schemas Zod canónicos host ↔ webview (contratos puros; ver `protocols/README.md`).                                                                                                                                                                          |
| `src/system/log/ConversationLog.ts`                | `conversation.md` bajo `storageUri`.                                                                                                                                                                                                                        |
| `src/system/log/SuggestionLog.ts`                  | `suggestions.md` bajo `storageUri`.                                                                                                                                                                                                                         |
| `src/system/log/LogManager.ts`                     | Logger estructurado con `GhostPrompt Log`, transporte OutputChannel y persistencia de logs en disco.                                                                                                                                                        |
| `src/system/status/`                               | Sistema de estados de proveedores (ProviderStatusManager + módulos por engine/destination).                                                                                                                                                                 |
| `src/system/build/verifyWebviewBundle.ts`          | Verificación del bundle webview en CI/dev.                                                                                                                                                                                                                  |
| `src/projectMemory/*`                              | _(obsoleto en árbol)_ — la memoria vive bajo `src/core/memory/`.                                                                                                                                                                                            |
| `src/ui/webview/react/index.html`                  | Shell HTML; Vite entry template. CSP, URIs de assets inyectados en runtime por `webviewHtml.ts`.                                                                                                                                                            |
| `src/ui/webview/dist/react/index.html` (build)     | Bundle generado por Vite desde `src/ui/webview/react/` (`npm run build:webview`).                                                                                                                                                                           |
| `src/ui/webview/react/index.css`                   | Tailwind + variables VS Code; ghost text.                                                                                                                                                                                                                   |
| `src/ui/webview/react/types.ts`                    | Barrel de tipos del panel (reexport desde `protocols/`).                                                                                                                                                                                                    |
| `src/ui/webview/react/webviewProtocolConstants.ts` | Barrel de constantes runtime `cons*` para hooks/componentes.                                                                                                                                                                                                |
| `src/ui/webview/react/webviewProtocolSchemas.ts`   | Reexport de schemas Zod usados en el sandbox (p. ej. `webviewOutboundMessageSchema`).                                                                                                                                                                       |
| `src/ui/webview/react/validators/parseWebviewInbound.ts` | Parseo host→panel (`webviewOutboundMessageSchema`); sin logging; tests de paridad con `api/boundary/webviewProtocols.ts`.                                                                                                                              |

---

## 3. Completion pipeline

```text
User types in textarea
        │
        ▼
  input → debounce (webview) → increment captureId
  postMessage { type:'suggest', text, captureId }
        │
        ▼  [Extension Host]
  parseWebviewInboundMessage → handleGhostPromptSuggest
    └── validación longitud mínima (trim) → empty/too-short si aplica
    └── GhostPromptSessionStore.prepareSuggestionRequest (captureId / cancelación)
    └── resolveCompletionSourceForRequest(selectedModelId, enabledSources)
    └── getCompletionProviderForSource(copilot | opencode | ollama).requestCompletion(...)
          ├── Copilot: vscode.lm … sendRequest → texto
          ├── OpenCode: createOpenCodeClient → healthCheck → sesión pooled →
          │             session.prompt; opcional consumeOpencodeSuggestionTextStream (preview SSE)
          └── Ollama: listModels (auto) → generate (HTTP POST /api/generate) → texto
    └── postMessage loading / suggestion-stream (OpenCode) / suggestion | empty | error
        │
        ▼  [Webview]
  Si captureId ≠ activo → descartar (stale)
  Si suggestion → showGhost
        │
        ▼ (Tab)
  postMessage { type:'accept', ... } → SuggestionLog
```

**Multi-fuente:** si `ghostPrompt.enabledCompletionSources` incluye varias fuentes, el modelo elegido en el selector determina el motor: `model:tag` → Ollama, `providerID/modelID` → OpenCode; id de chat Copilot → LM. Con fuente única no configurada, se usa el legacy `ghostPrompt.completionProvider`.

### Catálogo OpenCode y merge (`engines/opencode/catalog/`)

Esta capa **no** define cómo “piensa” el modelo lingüístico: adapta **datos y políticas** antes de llamar al LM.

| Pieza                                                                           | Responsabilidad                                                                                                                                                                                                                                     | ¿Sustituible por prompt al modelo?                                      |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `normalizeOpencodeProviderModels`                                               | El SDK puede devolver `models` como **array** o como **mapa**; se normaliza a lista de `{ id, … }` sin inventar campos.                                                                                                                             | **No** — sin esto no hay ids estables para `session.prompt`.            |
| `classifyOpencodeModelTier`                                                     | A partir de metadatos del catálogo (`pricing` tipo `0x`/`1x`, `free`) y reglas conservadoras por `providerID` (p. ej. proveedor `opencode`, backends locales), clasifica **included / premium / unknown** para `ghostPrompt.suggestionModelPolicy`. | **No** para cumplir **nonPremiumOnly**; no es redacción de sugerencias. |
| `listOpencodeSuggestionModels`                                                  | Construye filas del dropdown (etiqueta, tier), respeta `ghostPrompt.opencodeExcludedModelIds`.                                                                                                                                                      | UX                                                                      |
| `listOllamaSuggestionModels`                                                    | Lista modelos locales de Ollama vía `/api/tags`, respeta `ghostPrompt.ollamaExcludedModelIds`.                                                                                                                                                      | UX                                                                      |
| `listMergedSuggestionModels` (`engines/catalog/mergedModelCatalog.ts`)          | Concatena Copilot + OpenCode + **Ollama** y deduplica por `id` (prioriza Copilot).                                                                                                                                                                  | Multi-fuente                                                            |
| Resolución en `opencodeLmCompletion.ts` (`resolveOpencodeModelIdsFromSnapshot`) | Elige `providerID`/`modelID` alineado al snapshot cacheado y la política.                                                                                                                                                                           | Contrato del SDK                                                        |

El **texto** de la suggestion sigue gobernado por `core/prompt/instruction.ts`, post-proceso `core/prompt/normalize.ts`, y el LM/OpenCode en sí — véase roadmap v0.4.2 Fase 1.

### Eficiencia de llamadas inline (OpenCode)

Mitigaciones ya implementadas en GhostPrompt (sin duplicar trabajo del modelo lingüístico):

| Mecanismo                         | Ubicación típica          | Efecto                                                                                        |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| **Session pool**                  | `opencodeApiClient.ts`    | Sesiones reutilizadas con TTL (5 min) y max-size (4); evita `create`+`delete` por request.    |
| **Snapshot `config.providers()`** | `opencodeModelCatalog.ts` | Lista modelos del servidor OpenCode para el selector webview.                                 |
| **SSE preview**                   | `promptStreamOpenCode`    | Opcional; filtro por `sessionID`, recorte `maxPreviewChars`; abort compartido con el request. |

**Dependencia:** `@opencode-ai/sdk` (versión en `package.json`). El SDK se importa dinámicamente (`await import("@opencode-ai/sdk")`) por ser ESM-only. `createOpencodeClient` es síncrono — devuelve `OpencodeClient` directamente. Health check ligero via `client.config.get()`. Puerto por defecto: **4096** (configurable via `ghostPrompt.opencodePort`). Auth via `ghostPrompt.opencodeAuthToken`.

**Eliminado (v0.5.2):** runtime embebido (`OpenCodeRuntime.ts`), CLI detection, lifecycle management, warm-up, cola LM serie, sesión inline pool legacy, VSOpenCodeX bridge. OpenCode ahora es un motor tipo Ollama — conecta a instancia ya corriendo, sin levantar procesos propios.

### captureId pattern

Each debounce cycle increments `currentCaptureId` (webview-local counter). The host echoes the same `captureId` in its response. The webview discards any response whose `captureId` does not match the latest value — this prevents stale completions from earlier keystrokes from overwriting a newer ghost-text.

---

## 4. Host ↔ Webview message protocol

Los mensajes son JSON. Contratos **Zod** en `src/system/internals/protocols/validations/schemas/zschemWebviewMessages.ts`.

| Dirección | Schema | Parser |
| --------- | ------ | ------ |
| Webview → host | `webviewInboundMessageSchema` | `parseWebviewInboundMessage` en `api/boundary/webviewProtocols.ts` (con logging) |
| Host → webview | `webviewOutboundMessageSchema` | `parseWebviewInboundMessage` en `ui/webview/react/validators/parseWebviewInbound.ts` (sin `api/` ni log) |

Fixtures compartidos: `system/internals/protocols/validations/schemas/fixtures/webviewOutboundMessageFixtures.ts` (tests de paridad host y panel).

### Webview → Host (resumen)

| `type`            | Rol                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `init`            | Primera carga de la vista.                                                                        |
| `suggest`         | `{ text, captureId }` — pedir suggestion.                                                         |
| `draftChanged`    | Sincronizar borrador entre vistas (`originViewId`).                                               |
| `accept` / `send` | Tab en ghost-text / Enter para chat.                                                              |
| `updateSetting`   | Cambios desde chips (política, modelo, estilo, contexto, idioma, debug, `completionProvider`, …). |

### Host → Webview (resumen)

| `type`                           | Rol                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `settings`                       | Payload completo de UI (modelos, motor, `completionUiKind`, …).                                                                         |
| `loading`                        | Fase de carga (`phase`, `statusText`, `captureId`); incluye fases Copilot, OpenCode y **Ollama** (`ollama-start`, `ollama-generating`). |
| `suggestion-stream`              | OpenCode: texto acumulado por SSE antes del resultado final (`captureId`).                                                              |
| `suggestion` / `empty` / `error` | Resultado del intento (`captureId`).                                                                                                    |
| `languageEffective`              | Contrato host→webview; el flujo `suggest` actual **no** emite este mensaje (el webview lo ignora o lo tolera si reapareciera).          |
| `draftHydrate`                   | Hidrata el borrador en la webview **chat** al abrir/init (sin sync panel↔sidebar; `draftSync` eliminado en v0.6.2).                      |
| `clear`                          | Tras envío exitoso al chat.                                                                                                             |

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

| Path (relative to `ExtensionContext.globalStorageUri`)       | Content                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `ghostPrompt/projectMemory/v1/registry.json`                 | Workspace keys (`workspaceKey`), relative store folder name, `lastSeenAt` for whole-store GC.                               |
| `ghostPrompt/projectMemory/v1/stores/<sha256>/manifest.json` | Schema version and store metadata.                                                                                          |
| `ghostPrompt/projectMemory/v1/stores/<sha256>/entries.json`  | Bootstrap rows (`README*`, `package.json`, …) and optional **editor-ingest** rows; LRU fields; mtime/hash for invalidation. |

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

### Why Ollama as a third backend?

Ollama provides **local, offline-first** model inference with no API key or cloud dependency. GhostPrompt communicates with it via HTTP REST (`/api/tags` for model listing, `/api/generate` for completions with optional streaming). No embedded process or SDK is required; the user must have `ollama serve` running separately. Models are identified by their Ollama name literal (e.g. `mistral:latest`, `llama3:7b`). The routing heuristic `looksLikeOllamaModelId` detects the `model:tag` pattern (contains `:` but no `/`).

### Why two view containers instead of anchoring to `workbench.panel.chat`?

`workbench.panel.chat` is VS Code core-internal and is not an extension point. Third-party extensions cannot register views inside it. The dual `viewsContainers` approach (Activity Bar + Panel) is the correct and supported model.

### Why a `destinations/` module?

Destinations (where the final prompt is sent) are logically distinct from completion engines (which generate suggestions). `copilotChat` opens the Copilot Chat panel; `vsOpenCodeX` forwards the UI to the VSOpenCodeX extension. A registry pattern (`destinationRegistry.ts`) with per-destination modules allows adding new destinations without touching the suggest pipeline or host handlers. The active destination is resolved at runtime via `getAgentDestination()` reading `ghostPrompt.agentDestination`, or auto-detected when VSOpenCodeX is installed but no explicit preference is saved.

### Why `storageUri ?? globalStorageUri`?

`context.storageUri` is `undefined` when no folder/workspace is open. `globalStorageUri` is always defined. The fallback ensures the extension works in a windowless or folder-less VS Code session.

---

## 8. Roadmap

### v0.6 — Fase G: layout `core/` (`routing/`, `contracts/`, `suggest/`, `prompt/`, `presentation/`, `streaming/`, `state/`, `language/`)

- **`engines/config/completionSources.ts`** + **`engines/routing/resolveCompletionSource.ts`** — configuración y routing de fuentes LM (antes `core/routing/sources.ts` → `system/internals/config/sources.ts`).
- **`core/contracts/completion.ts`** — contratos de completion; `types.ts` reexporta.
- **`core/suggest/`** — orquestación del mensaje `suggest` (sucesor de `core/pipeline/` en v0.5.3).
- **`core/prompt/`** — instrucción LM y post-proceso (`instruction`, `normalize`).
- **`core/presentation/loading.ts`** — fases de carga host↔webview.
- **`engines/copilot/collectLmResponse.ts`** — reensamblado del texto del stream del LM de VS Code (Copilot).
- **`core/state/`** — `GhostPromptSessionStore` (singleton host Sidebar+Panel).
- **`core/language/`** — detección y resolución de idioma de suggestion.
- **`core/memory/projectBootstrapContext.ts`** — bootstrap README/package (antes `core/context/`); carpeta `core/context/` eliminada.
- **`system/policies/SuggestionRequestGovernor.ts`** — governor legacy (antes `core/governor/`); carpeta `core/governor/` eliminada; **no** invocado por `runSuggest`.

### v0.5.3 — Desmantelar `host/` → `api/` + `vscode/` + `core/pipeline/`

- **`api/`** — API interna webview↔host: protocolos Zod, inbound handlers, settings flow, workspace getters.
- **`vscode/`** — Integración VS Code: `WebviewViewProvider`, HTML/CSP generation, notifications.
- **`core/pipeline/`** — Orquestación del mensaje `suggest` (LM routing, fases `loading`, broadcast). El governor legacy no forma parte de este hot path (hoy `system/policies/SuggestionRequestGovernor.ts`).
- Carpeta `host/` eliminada completamente.
- 226 tests passing, `npm run check` verde.

### v0.5.2 — Reorganización `core/` + `system/`

- **`core/`** — Lógica pura de suggestions (types, `prompt/`, `streaming/`, `language/`, `presentation/`, `routing/sources`, `state/`, `memory/` incl. bootstrap proyecto; catálogo merged → `engines/`).
- **`system/`** — Infra transversal (debug, log, contracts, build).
- Carpetas eliminadas: `completion/`, `governor/`, `session/`, `debug/`, `log/`, `shared/`, `build/`.
- 226 tests passing, `npm run check` verde.

### v0.5.1 — Ollama engine integration + destinations refactor

- **Ollama** como tercer motor de completado local (offline-first, HTTP REST sin SDK embebido) — [`Roadmap-v0.5.1-ollama-integration.md`](./Plans/Roadmaps/Roadmap-v0.5.1-ollama-integration.md).
- **Arquitectura engines/:** migración de `completion/providers/` a `src/engines/` canónico (copilot, opencode, ollama).
- **Catálogo unificado:** merge de modelos Copilot + OpenCode + Ollama en el dropdown webview.
- **Routing:** `model:tag` → Ollama, `providerID/modelID` → OpenCode, default → Copilot.
- **Refactor destinations/:** [`Roadmap-v0.5.1-destinations-refactor.md`](./Plans/Roadmaps/Roadmap-v0.5.1-destinations-refactor.md) — `vsOpenCodeXBridge.ts` → `engines/opencode/vsOpenCodeXConnection.ts`, nueva carpeta `src/destinations/` con `copilotChat/` y `vsOpenCodeX/`, `destinationRegistry.ts` con interfaz `DestinationProvider`.

- **Project memory:** per-workspace-folder JSON under `globalStorageUri/ghostPrompt/projectMemory/v1/` — [`Roadmap-v0.4-project-context-store.md`](./Plans/Roadmaps/Roadmap-v0.4-project-context-store.md).
- **OpenCode:** catalog cache, pooled inline session, debug perf logs, serialized LM queue — [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md).
- **Maintainability:** layer ownership — [`Owners.md`](./Owners.md).

### v0.4.2 — LM efficiency audit (**cerrado**)

- Informe y decisiones — [`Roadmap-v0.4.2-lm-efficiency-audit.md`](./Plans/Roadmaps/Roadmap-v0.4.2-lm-efficiency-audit.md). **Copilot LM:** dos mensajes `User`. **`@vscode/prompt-tsx`:** no adoptado. **Catálogo OpenCode:** tab §3. **OpenCode inline:** cola, pool, snapshot, SSE — tab §3 (Fase 4).

### v0.4.3 — Quality & resilience (in progress)

- Tests pipeline, OpenCode release/CI, errores UX, tipos SDK, dual webview — [`Roadmap-v0.4.3-quality-resilience.md`](./Plans/Roadmaps/Roadmap-v0.4.3-quality-resilience.md). **Release OpenCode:** [`Releasing-opencode-integration.md`](./Plans/Releasing-opencode-integration.md); **CI:** `.github/workflows/ci.yml`; integración OpenCode **manual** (`opencode-integration.yml`).

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
