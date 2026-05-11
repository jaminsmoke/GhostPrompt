# GhostPrompt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GhostPrompt](https://img.shields.io/badge/GhostPrompt-0.4.1-6366f1?style=flat)](https://github.com/jaminsmoke/GhostPrompt)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90%2B-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![GitHub Copilot](https://img.shields.io/badge/Uses-GitHub_Copilot-24292f?logo=github&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)

![GhostPrompt banner](./media/img/ghostpromp-Banner.png)

> Ghost-text completions for your Copilot prompts — write faster, think clearer.

<!-- markdownlint-disable-next-line MD036 -->
**Version 0.4.1** *(pendiente de publicación en marketplace; última publicada: **0.4.0**.)*

---

## Why GhostPrompt

Writing prompts in Copilot Chat is often repetitive and context-switch heavy.  
**GhostPrompt** gives you an inline mini-composer inside VS Code with ghost-text suggestions, so you can draft faster and send to Copilot Chat without breaking flow.

### Benefits at a glance

- Faster prompt drafting with inline continuation suggestions
- Safer usage controls (included-model policy, request governor)
- Better writing flow with keyboard-first interactions (`Tab`, `Enter`)
- Compact controls directly inside the composer (policy/style/context/debug)

## Preview

Screenshots are **collapsed by default** so the README stays scannable; click a title to expand. Images are shown at **native resolution** (no `width` scaling in markup) so text stays sharp; swap the PNG files if you want smaller repo size.

### Video demo

Watch GhostPrompt in action on YouTube: [GhostPrompt demo](https://youtu.be/luGP-APDt7I?si=wwIHOBqHhyYdhT-H).

<!-- markdownlint-disable MD033 -->

<details>
<summary><strong>1 · Icon and inline composer</strong></summary>

<img src="./media/img/ImagesReadme1.png" alt="GhostPrompt extension icon and inline composer overview">

</details>

<details>
<summary><strong>2 · Inline continuation in action</strong></summary>

<img src="./media/img/ImagesReadme2.png" alt="GhostPrompt inline ghost-text continuation">

</details>

<details>
<summary><strong>3 · Next to Copilot Chat</strong></summary>

<img src="./media/img/ImagesReadme3.png" alt="GhostPrompt panel near Copilot integration">

</details>

<details>
<summary><strong>4 · Quick controls (model, style, context)</strong></summary>

<img src="./media/img/ImagesReadme4.png" alt="GhostPrompt quick control strip">

</details>

<!-- markdownlint-enable MD033 -->

---

## Key features

- **Inline ghost-text completions** — suggestions appear as continuation of your current text. Press `Tab` to accept.
- **One session, two views** — the Activity Bar sidebar and bottom Panel mirror the **same draft, settings, and suggestion state**. Open both at once without drift; edits and chips stay in sync in real time.
- **Always visible** — choose sidebar, panel tab, or both; layout is preference, not duplicated state.
- **One-key send** — `Enter` sends your prompt to Copilot Chat. `Shift+Enter` adds a newline.
- **Request safety controls** — dedupe, cache, cooldown, rate-limit, and session budget to prevent over-calling.
- **Model policy controls** — force included (`0x`) models by default, with optional override.
- **Non-intrusive** — completions run via `vscode.lm`; no draft editor tabs, no focus stealing.
- **Private logs** — accepted suggestions and sent prompts are saved in the extension's private storage (not inside your project).
- **Project context (v0.4)** — with **`contextMode: project`** and project memory enabled, GhostPrompt can attach short excerpts from your workspace (bootstrap files + optional editor-ingest) to the LM instruction. Data stays under the extension’s **global storage** (see [Privacy and on-disk data](#privacy-and-on-disk-data-v04)).

---

## Privacy and on-disk data (v0.4)

GhostPrompt never writes project-memory JSON **inside your repository** by default. Indexed snippets and registry metadata live only under the extension host’s storage:

| Location | Contents |
| -------- | -------- |
| **`ExtensionContext.globalStorageUri/ghostPrompt/projectMemory/v1/`** | `registry.json` (workspace keys + `lastSeenAt`), `stores/<workspaceKeySha>/entries.json` (bootstrap + editor-ingest items), `manifest.json`. |

- **What may be stored:** truncated text derived from files you open or from standard bootstrap paths (`README*`, `package.json`), plus metadata (`relativePath`, mtime, content hash, LRU timestamps). Nothing is uploaded by GhostPrompt itself beyond what you already send to your chosen completion backend (Copilot LM / OpenCode) when you request a suggestion.
- **Opt-out / disable:** set **`ghostPrompt.projectMemoryEnabled`** to **`false`** to stop persisting and merging this store into suggestions (volatile bootstrap read may still occur depending on version; global toggle is the supported off switch for disk-backed memory).
- **Editor ingest & watchers:** **`ghostPrompt.projectMemoryEditorIngestEnabled`** controls indexing focused files; **`ghostPrompt.projectMemoryFileWatcherEnabled`** controls proactive invalidation watchers (disable to reduce background file subscriptions).
- **Delete locally:** command **`GhostPrompt: Clear Project Memory (This Workspace)`** removes the store for the workspace folder tied to the active editor (or the first folder in a multi-root setup when resolving that command).
- **Stale stores:** GhostPrompt may delete entire per-repo folders under global storage if unused longer than **`ghostPrompt.projectMemoryUnusedStoreTtlDays`** (default **30**).

For the full settings matrix, search **`ghostPrompt.projectMemory`** in VS Code Settings.

---

## Requirements

- VS Code **1.90** or later
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension installed and signed in *(default completion backend)*

### Optional: OpenCode backend

If you set **`ghostPrompt.completionProvider`** to **`opencode`**, GhostPrompt starts its **own** local OpenCode server (see [`Roadmap-v0.3-opencode-integration.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md)). You need the **OpenCode CLI** on your PATH (`opencode --version` should succeed). Configure models and provider credentials in OpenCode as described in the upstream docs ([OpenCode SDK](https://opencode.ai/docs/sdk)). Authentication for third-party APIs is handled by OpenCode, not by GhostPrompt.

**Cold start & lifecycle (v0.3.0c):** The first suggestion after the embedded server has been stopped can take noticeably longer (spawn + listen + health). Opening a GhostPrompt view while OpenCode is selected runs a **warm-up** (`start` + light health ping) in the background, throttled so Sidebar + Panel do not double work. Switching back to **Copilot** **schedules** shutdown of the OpenCode process after **45 seconds** so quick toggles avoid paying cold start again. Use **GhostPrompt: Toggle Debug** and the **GhostPrompt Suggestions** output channel to see `[opencode]` timing lines (`cold-start-complete`, `first-config-get`, `first-session-prompt`).

**Model catalog cache (v0.4+):** GhostPrompt keeps a single in-memory snapshot of OpenCode’s **`config.providers()`** (shared by the webview dropdown and inline suggestions) once the server is running; the warm-up **prefetches** that snapshot. The cache is **cleared when the extension deactivates** (reload window or quit). If you change providers or models in OpenCode externally, **reload the window** so the list and model routing match the new configuration. See [`Roadmap-v0.4-opencode-perf-catalog-telemetry.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-opencode-perf-catalog-telemetry.md).

**Inline session reuse (v0.4+, phase H):** While the embedded server stays up, GhostPrompt **reuses one OpenCode session** for repeated inline suggestions (`session.create` is not fired on every keystroke). The pool resets when the server restarts, on timeout/cancellation, or on envelope errors (see roadmap phase H). If OpenCode retains prior turns inside that session and you notice odd context bleed, reload the window to force a new session cycle.

---

## Completion provider (Copilot LM vs OpenCode)

| Setting | Behavior |
| ------- | -------- |
| `ghostPrompt.completionProvider = copilot` *(default)* | Inline suggestions use **`vscode.lm`** (GitHub Copilot chat models). |
| `ghostPrompt.completionProvider = opencode` | Suggestions use your **OpenCode** installation via GhostPrompt’s embedded server (port **17433** by default). The webview lists models from OpenCode’s catalog; model ids use `providerID/modelID`. |
| **`ghostPrompt.enabledCompletionSources`** *(optional)* | Array such as `[ "copilot", "opencode" ]` to show **both** catalogs in one dropdown and **route** by selected model (`providerID/modelID` → OpenCode; Copilot chat model id → Copilot LM). If you **never** save this key, GhostPrompt keeps using **`completionProvider`** only (backward compatible). |

Switch providers in **Settings** (search `ghostPrompt.completionProvider` or `enabledCompletionSources`). With **both** sources enabled, the composer shows **Motor: Copilot + OpenCode** and **Auto (Copilot primero)** uses Copilot when available.

Related settings: **`ghostPrompt.opencodeExcludedModelIds`** (hide specific `providerID/modelID` rows), **`ghostPrompt.selectedModelId`** (`auto` or an explicit id).

**VSOpenCodeX coexistence:** If you use the sibling extension **VSOpenCodeX** (`jaminsmoke.vsopencodex`), GhostPrompt can reuse its OpenCode server (via `vsopencodex.getOpenCodeConnection`) instead of starting a **second** `opencode serve` on the same port. Settings **`ghostPrompt.preferVsOpenCodeXOpenCode`** (default on) and **`ghostPrompt.vsOpenCodeXProbeDelayMs`** control that handshake. Without VSOpenCodeX, GhostPrompt keeps using its **embedded** OpenCode runtime as today. Specification: [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](./Docs/Integrations/GhostPrompt-OpenCode-coexistence.md); roadmap [**v0.6.0**](./Docs/Plans/Roadmaps/Roadmap-v0.6-vsopencodex-coexistence.md) tracks optional **Send → VSOpenCodeX** separately.

**OpenCode model tiers (dropdown):** Tiers come **only** from catalog metadata (`pricing` multipliers such as `0x` / `1x`, **`free`**, or the provider id for the built-in **`opencode`** / typical **local** backends like Ollama). GhostPrompt does **not** infer premium vs free from model names. Rows without usable signals stay **Sin clasificar** / **UNKNOWN**. With **`nonPremiumOnly`**, models classified as **premium** are hidden from the list and excluded from **Auto** selection.

---

## Quick start (30 seconds)

1. Open **GhostPrompt** from the Activity Bar (chat-bubble icon) and/or the bottom **Panel** tab — both show the same in-progress prompt.
2. Start typing your prompt — after a short pause, a ghost-text continuation appears inline (and matches if both views are open).
3. Press `Tab` to accept the suggestion and append it to your prompt.
4. Press `Enter` to send the final prompt to **Copilot Chat**.

*Screenshots: expand **2 · Inline continuation** in [Preview](#preview) above.*

### Integrated with Copilot

You can keep GhostPrompt near Copilot Chat and move quickly between drafting and sending prompts.

*See **3 · Next to Copilot Chat** in [Preview](#preview).*

---

## Keyboard shortcuts

| Key           | Action                                   |
| ------------- | ---------------------------------------- |
| `Tab`         | Accept the current ghost-text suggestion |
| `Enter`       | Send prompt to Copilot Chat              |
| `Shift+Enter` | Insert a newline in the prompt           |

---

## Settings

### Completion provider & models

- **`ghostPrompt.completionProvider`**: `copilot` *(default)* or `opencode` — legacy single-backend switch when **`enabledCompletionSources`** has not been saved; see [Completion provider](#completion-provider-copilot-lm-vs-opencode).
- **`ghostPrompt.enabledCompletionSources`**: e.g. `[ "copilot", "opencode" ]` for a unified model list (optional).
- **`ghostPrompt.selectedModelId`**: `auto` or a concrete model id; with OpenCode, ids are `providerID/modelID`.
- **`ghostPrompt.opencodeExcludedModelIds`**: array of OpenCode model ids to hide from the dropdown (only applies when the provider is OpenCode).

### Model policy *(Copilot LM)*

- `ghostPrompt.suggestionModelPolicy = nonPremiumOnly` (default): only included (`0x`) models are allowed when pricing metadata is available.
- `ghostPrompt.suggestionModelPolicy = anyModel`: uses the first available model (may consume premium quota).

### Suggestion quality

- `ghostPrompt.maxSuggestionChars` (default `180`)
- `ghostPrompt.suggestionStyle` (`concise` | `balanced` | `detailed`, default `balanced`)
- `ghostPrompt.contextMode` (`off` | `basic` | `project`, default `basic`)
- `ghostPrompt.suggestionLanguageMode` (`auto` | `manual`, default `auto`)
- `ghostPrompt.suggestionLanguage` (`es` | `en`, used when `suggestionLanguageMode=manual`)

### Request governor (cost/frequency protection)

- `ghostPrompt.minCharsForSuggestion` (default `6`)
- `ghostPrompt.suggestionDebounceMs` (default `400`) — wait after you stop typing before requesting a suggestion (reduces LM calls while drafting)
- `ghostPrompt.requestCooldownMs` (default `500`) — host-side cooldown when the **same** normalized text is requested again
- `ghostPrompt.cacheTtlMs` (default `45000`)
- `ghostPrompt.rateLimitMaxRequests` (default `90`)
- `ghostPrompt.rateLimitWindowMs` (default `600000`)
- `ghostPrompt.sessionRequestBudget` (default `300`)

### Debug mode

- Run command: `GhostPrompt: Toggle Debug`
- Output channel: `GhostPrompt Suggestions`
- Setting: `ghostPrompt.debugSuggestions`
- With **`ghostPrompt.completionProvider`** set to **`opencode`** (or OpenCode-routed models when using multi-source mode), suggestion requests also emit timing lines prefixed **`[opencode-perf]`** in **GhostPrompt Suggestions**, tied to each webview `captureId`: providers snapshot (`providers`, `providers-network-fetch-ms`), pooled session reuse vs `session-create`, **`prompt`** round-trip, optional **`stream-first-delta`** / **`sse-consumer-settled`**, and **`opencode-lm-total`**. Only when **`ghostPrompt.debugSuggestions`** is on (`Toggle Debug` / chips). Same channel still shows **`[capture:…]`** stages for Copilot/OpenCode orchestration (`request-start`, `request-success`, etc.).

Inside the webview mini-input, you can also change policy, style, context, and debug from the **control strip** (chips at the top). See **4 · Quick controls** in [Preview](#preview).

### Project memory (v0.4)

Requires an open workspace folder for paths relative to that folder. Summary — tune in Settings (`ghostPrompt.projectMemory*`):

| Setting | Role |
| ------- | ---- |
| `projectMemoryEnabled` | Master switch for persisted reconcile + disk store. |
| `projectMemoryEditorIngestEnabled` | Focused-file excerpts (extension/size filters). |
| `projectMemoryMaxTotalBytes` / `projectMemoryMaxEditorSources` | LRU caps for editor-ingest pool. |
| `projectMemoryUnusedStoreTtlDays` | GC for whole store folders left unused. |
| `projectMemoryFileWatcherEnabled` / `projectMemoryFileWatcherThrottleMs` | Invalidate indexed paths on external change/delete (optional). |

Command: **`GhostPrompt: Clear Project Memory (This Workspace)`**. Details: [`Roadmap-v0.4-project-context-store.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-project-context-store.md).

### Manual QA checklist (before publishing v0.4.x)

1. **Multi-root:** open a workspace with **two folders**; confirm each folder gets an isolated store (different hashes under `globalStorageUri/.../stores/`); suggestions in **project** mode do not mix excerpts across roots.
2. **Clear command:** run **`GhostPrompt: Clear Project Memory (This Workspace)`**; confirm the active folder’s store is removed and suggestions no longer include old excerpts until files are re-indexed.
3. **Context modes:** with **`ghostPrompt.contextMode`**: **`off`** — no project/bootstrap lines; **`basic`** — session-only context; **`project`** — bootstrap ± editor lines per settings above.

## Developing and tests

From the repo root:

| Command | What it does |
| ------- | ------------ |
| `npm run validate` | ESLint on `src` + **no circular deps** (`deps:circular`) + extension `tsc` + **webview** typecheck (`webview/tsconfig.json`) + esbuild bundle (`webview/dist/main.js`) + **`verify:webview-bundle`** (`src/build` → `out/build`) |
| `npm run build:webview` | Build webview only: `webview/src/main.ts` (+ modules under `webview/src/`) → **`webview/dist/main.js`** (IIFE, esbuild). The extension host loads this file via CSP-safe URI substitution in `ghostPromptWebviewHtml.ts`. |
| `npm run typecheck:webview` | `tsc --noEmit` for the webview tree only |
| `npm run test` | Vitest unit tests (OpenCode is **mocked**; safe for CI, no network) |
| `npm run check` | `validate` + `test` — run before shipping or opening a PR |

Edit webview behavior in **TypeScript** under `webview/src/` (not hand-edit `webview/dist/main.js`; it is regenerated). After changing webview sources, `npm run validate` or `npm run build:webview` refreshes the bundle.

### Webview ↔ host message contracts (v0.3.2)

- **Canonical Zod schemas:** [`src/shared/webviewMessageSchemas.ts`](./src/shared/webviewMessageSchemas.ts) — single source of truth for `postMessage` payloads (inbound to the extension host and the mirrored outbound shape from the webview).
- **Host boundary:** [`src/host/webviewProtocols.ts`](./src/host/webviewProtocols.ts) re-exports those schemas and runs `parseWebviewInboundMessage` / `parseOutboundSettingsEnvelope` at the channel edge.
- **Webview boundary:** [`webview/src/protocol/postToHost.ts`](./webview/src/protocol/postToHost.ts) validates outbound messages with the same inbound schema before calling `postMessage` (bundled with the webview).

**Checklist when you change message shapes:** edit `src/shared/webviewMessageSchemas.ts` first; update protocol comments in `webview/src/main.ts` if needed; run **`npm run check`** (runs extension `tsc`, webview typecheck + esbuild bundle, and tests including `tests/shared/webviewMessageSchemas.test.ts` and `tests/webviewProtocols.test.ts`).

### Dual webview (sidebar + panel) — contributor checklist (v0.4.3)

GhostPrompt registers **two** `WebviewViewProvider` instances (`ghostPrompt.input` and `ghostPrompt.inputPanel`) backed by the **same** HTML/JS/CSS bundle. Changes to the toolbar, chips, or protocol must stay **symmetric** unless a roadmap explicitly documents a divergence.

| Rule | Detail |
| ---- | ------ |
| **Single bundle** | HTML is built only in `src/host/ghostPromptWebviewHtml.ts` → `webview/index.html`, **`webview/dist/main.js`**, `webview/style.css`. Do not maintain separate templates per view. |
| **Capabilities** | `MiniInputViewProvider` passes `viewContributionId` into `window.__ghostPromptCapabilities`; use it for layout flags only—keep suggestion/settings behavior identical across views. |
| **Shared copy** | User-visible empty/error strings for the status line live in **`webview/src/lib/userErrorMessage.ts`**. Optional host toasts (`src/host/suggestionHostNotification.ts`) should stay aligned for the same actionable cases. |
| **Regression tests** | Before merging webview or toolbar edits, run **`npm run check`** (includes `tests/webviewToolbarParity.test.ts`, `tests/webviewProtocols.test.ts`, `tests/webview/userErrorMessage.test.ts`). |

### Architecture and dependencies (v0.3.2)

High-level roadmap: [`Docs/Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md).

| Command | What it does |
| ------- | ------------ |
| `npm run deps:graph` | Lists the dependency tree from `src/extension/extension.ts` (uses [madge](https://github.com/pahen/madge); optional ad‑hoc inspection — **`deps:circular`** is what runs in `validate`). |
| `npm run deps:circular` | Fails with exit code `1` if circular imports are found (same entrypoint). Also runs automatically as part of **`npm run validate`** / **`npm run check`**. |
| `npm run verify:webview-bundle` | Runs the compiled smoke script `out/build/verifyWebviewBundle.js` (source: [`src/build/verifyWebviewBundle.ts`](./src/build/verifyWebviewBundle.ts)). Checks that `webview/dist/main.js` exists after esbuild. **Not shipped in the VSIX** — `.vscodeignore` excludes `out/build/**`; this is dev/CI tooling only, not extension runtime. |

**Layering (ESLint):** files under `src/opencode/` must not import from `src/host/` (`import/no-restricted-paths`). The host may depend on OpenCode (e.g. warm-up), but not the reverse.

**Soft size guideline:** prefer keeping new host modules under ~400 lines per file unless the content is mostly data; split extractors before crossing ~800 lines without a strong reason (same spirit as roadmap Phase A).

### OpenCode integration tests (optional)

These exercises use your real **OpenCode CLI**, GhostPrompt’s embedded server on **127.0.0.1:17433**, and a configured model. They are **off by default** (`describe.skipIf`) so `npm run test` stays fast without CLI or API keys.

**Prerequisites:** `opencode --version` succeeds; providers and models are configured in OpenCode (same as using the extension with **`ghostPrompt.completionProvider`: `opencode`**).

**PowerShell**

```powershell
$env:GHOST_PROMPT_OPENCODE_INTEGRATION = "1"
npm run test:integration
```

**bash**

```bash
export GHOST_PROMPT_OPENCODE_INTEGRATION=1
npm run test:integration
```

Optional — force a specific catalog id if `auto` picks the wrong model (`providerID/modelID`):

```powershell
$env:GHOST_PROMPT_OPENCODE_MODEL = "your-provider/your-model-id"
npm run test:integration
```

The suite lives in [`tests/opencodeSuggestions.integration.test.ts`](./tests/opencodeSuggestions.integration.test.ts).

**Release (OpenCode):** checklist mantenedor y notas de CI — [`Docs/Plans/Releasing-opencode-integration.md`](./Docs/Plans/Releasing-opencode-integration.md). Resumen: **`npm run check` siempre**; si tocaste el motor OpenCode, además **`GHOST_PROMPT_OPENCODE_INTEGRATION=1 npm run test:integration`** en una máquina con CLI. En GitHub: el workflow **OpenCode integration** es solo **manual** y requiere `opencode` en el PATH del runner (p. ej. self-hosted); el **CI** estándar (`.github/workflows/ci.yml`) ejecuta `npm run check` en PR/push a `main` **sin** OpenCode.

## Roadmap

v0.2 is **shipped**; roadmap documents:

- Archived v0.2: [`Docs/Plans/Roadmaps/Roadmap-v0.2.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.md)
- Current v0.2.2 execution: [`Docs/Plans/Roadmaps/Roadmap-v0.2.2.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.2.md)
- Unified session (Sidebar + Panel): [`Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md) *(complete)*
- **v0.3.0 — `src` layout & completion providers** *(architecture complete; OpenCode & VSIX bundling landed in-repo)*: [`Docs/Plans/Roadmaps/Roadmap-v0.3.0-architecture.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.0-architecture.md)
- **OpenCode integration** *(Phases 1–4 complete)*: [`Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md)
- **v0.3.0c — OpenCode UX, rendimiento y multi‑proveedor** *(plan activo, misma línea 0.3.0)*: [`Docs/Plans/Roadmaps/Roadmap-v0.3.0c-opencode-ux-perf.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.0c-opencode-ux-perf.md)
- **v0.4.0 — Memoria de proyecto por workspace (JSON), contexto bootstrap + editor** *(phases A–F shipped)*: [`Docs/Plans/Roadmaps/Roadmap-v0.4-project-context-store.md`](./Docs/Plans/Roadmaps/Roadmap-v0.4-project-context-store.md)
- **v0.6.0 — VSOpenCodeX coexistence + optional send target** *(planned)*: [`Docs/Plans/Roadmaps/Roadmap-v0.6-vsopencodex-coexistence.md`](./Docs/Plans/Roadmaps/Roadmap-v0.6-vsopencodex-coexistence.md) — spec: [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](./Docs/Integrations/GhostPrompt-OpenCode-coexistence.md)

Full release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md).

---

## Release notes

### 0.4.1 *(pendiente de publicación)*

- **OpenCode observability:** with debug on (**`GhostPrompt: Toggle Debug`** / **`ghostPrompt.debugSuggestions`**), **`[opencode-perf]`** lines in **GhostPrompt Suggestions** (per-request `captureId`): catalog snapshot, pooled session vs `session-create`, **`prompt`** timing, SSE first delta / drain, LM total — see § [Debug mode](#debug-mode).
- **Docs:** roadmap OpenCode perf **I–J** complete; **`CHANGELOG.md`** section **`[0.4.1]`** mirrors this; install the VSIX from `npm run vsix` to validate locally against marketplace **0.4.0**.

### 0.4.0

- **Project memory:** per-workspace-folder JSON under extension global storage (`ghostPrompt/projectMemory/v1/`): bootstrap excerpts, optional editor-ingest with LRU/quotas, reconcile before LM requests when **`contextMode: project`** and **`projectMemoryEnabled`**.
- **Hygiene:** TTL GC for unused stores, optional file watchers on indexed paths only, command to clear memory for this workspace.
- **Docs:** README privacy section, `ARCHITECTURE.md` storage update, roadmap v0.4 phases A–F complete.

### 0.3.0

- **Architecture:** `src/` split into layered folders (`completion/`, `host/`, `session/`, etc.) and a documented completion pipeline (`CompletionProvider`, provider registry).
- **Copilot LM:** existing `vscode.lm` path unchanged as default (`ghostPrompt.completionProvider`: `copilot`).
- **OpenCode (optional):** `ghostPrompt.completionProvider`: `opencode`, embedded server on **127.0.0.1:17433**, CLI detection, webview catalog + exclusions, `@opencode-ai/sdk` bundled in the VSIX.
- **Docs & tests:** README provider section and [Developing and tests](#developing-and-tests); CHANGELOG; unit tests mock the OpenCode runtime (no network in CI); optional live OpenCode integration test behind `GHOST_PROMPT_OPENCODE_INTEGRATION=1` (`npm run test:integration`).
- **Release:** build a VSIX anytime with `npm run vsix`; git tag `v0.3.0` optional—see [`CHANGELOG.md`](./CHANGELOG.md).

### 0.2.5

- **Unified GhostPrompt session** — single host session state for Activity Bar and Panel: shared draft, settings, loading/suggestion UI, and one active completion request across views.
- **Tighter style calibration** — completion instructions use explicit `STYLE_CONCISE` / `STYLE_BALANCED` / `STYLE_DETAILED` rules for repeatable length behavior.
- **Narrow layout parity** — control strip wraps instead of horizontal-only scroll; hints wrap on small widths; optional `__ghostPromptCapabilities` hook for future layout flags.
- **Regression tests** — multi-view store notifications and style injection in completion requests (`npm run test`).

### 0.2.4

- **Pricing-aware model tiers**: model classification now uses passive runtime metadata (`pricing`, e.g. `0x`, `0.33x`, `1x`) without extra model generation requests.
- **No hidden quota usage for tier sync**: GhostPrompt does not probe models for pricing; it only reads model catalog metadata.
- **UI tier clarity**: model labels now use `Included / Premium / Unknown` and display pricing multiplier when available.
- **Model list deduplication**: repeated model entries (same visible label/tier/pricing) are collapsed so the selector does not show duplicates like multiple `GPT-4o`.
- **Provider grouping**: model selector is grouped and ordered by inferred provider (OpenAI, Anthropic, Google, xAI, GitHub, Other) for quicker navigation.
- **Final token UX polish**: selector rows now show tier/cost with compact textual chips (`[INCLUDED 0x]`, `[PREMIUM 1x]`, `[UNKNOWN]`) for faster visual scan.
- **Loading feedback polish**: status line now shows a spinner while suggestions are being generated (`Buscando sugerencia...`).
- **Normalization hardening**: host-side normalization is now the only source of truth for spacing boundaries, reducing split-word artifacts in inline preview/accept.
- **Better leading-space intent**: completion instruction now differentiates between "continue current word" (no leading space) and "start new word" (single leading space).
- **Terminology and reason cleanup**: empty reason updated to `no-included-model` and user-facing messages aligned to included-model policy.
- **Dev tooling isolation**: pricing audit helper remains under `Scripts/` and is not part of production extension packaging.
- **Known runtime limitation**: in some environments `gpt-5-mini` and `raptor` can timeout without returning suggestion chunks; GhostPrompt now recovers gracefully and prompts retry/model switch.

### 0.2.3

- **Punctuation boundary polish**: better spacing when suggestions continue after punctuation (e.g. `:`, `;`, `,`) with no extra duplicated separators.
- **Model selector redesign**: model dropdown with explicit tier labels and persisted preferred model selection.
- **Model transparency**: effective model metadata is now traceable in pipeline/debug and visible in webview runtime status.
- **Scoped cache keys**: cache now separates suggestions by language/style/context/model dimensions to avoid cross-configuration collisions.
- **Language stability**: auto language detection now uses confidence threshold + hysteresis + fallback for short/mixed inputs.
- **Validation and packaging**: `npm run check` and VSIX packaging verified for `0.2.3`.

### 0.2.2

- **Request governor retune**: more generous defaults (`requestCooldownMs=500`, `rateLimitMaxRequests=90`, `sessionRequestBudget=300`) with clearer blocked-state guidance in UI.
- **Context quality**: new `contextMode=project`, adding lightweight workspace/file/language/selection signals plus recent prompts.
- **Ghost text robustness**: improved normalization for overlap and incomplete trailing-word duplication; safer boundary insertion on `Tab` acceptance.
- **Suggestion language control**: `auto` detection from user input plus manual `ES/EN` override in the webview controls.
- **Validation**: `npm run check` green.

For complete details and historical versions, see [`CHANGELOG.md`](./CHANGELOG.md).

### 0.2.0

- **Inline ghost-text** in the composer, including scroll/height behavior for long suggestions.
- **Suggestion pipeline**: typed results (`suggestion`, `empty`, `error`, `loading`), no silent failures.
- **Request governor** (dedupe, cache, cooldown, rate limit, session budget) to limit accidental over-calling.
- **Model policy**: default **included-model** selection with optional `anyModel` override; commands and settings for policy/debug.
- **Quality controls**: suggestion style (`concise` / `balanced` / `detailed`), `maxSuggestionChars`, optional **session context** (`contextMode`).
- **Webview UX**: compact chip controls, keyboard/a11y polish, layout fixes for narrow Activity Bar views.
- **Tests**: Vitest suite (`npm run test` / `npm run check`).
- **Docs**: debug flow guide, README screenshots (collapsible), repository metadata for marketplace.

### 0.0.1

Initial release: dual-panel registration (Activity Bar + bottom Panel), ghost-text completions via `vscode.lm`, Tab-to-accept, Enter-to-send.

---

## License

This project is released under the [MIT License](./LICENSE).

Badges are **informational only** (versions, stack, and links). They do not imply endorsement by Microsoft, GitHub, or the VS Code team. **GitHub**, **GitHub Copilot**, and **Visual Studio Code** are trademarks of their respective owners.

### Forks, clones, and renaming

The MIT License **allows** others to copy, modify, and redistribute the code, including under a different product name, **as long as they include the original copyright notice and a copy of the MIT license** in the substantial portions they distribute. That means someone could fork the repo and publish “AutoCompletion”-style marketing or chase SEO: that is legally permitted for the **code** under MIT, provided the license terms are honored.

What MIT does **not** automatically grant:

- exclusive use of the name **GhostPrompt** (that is trademark territory; a registered mark offers stronger protection than OSS license alone);
- any rights to use **third-party trademarks** (Copilot, VS Code logos, etc.) beyond what those companies allow in their brand guidelines.

If you want stronger naming protection, consider registering a trademark for the product name in your jurisdiction and publishing clear branding in the Marketplace listing first.
