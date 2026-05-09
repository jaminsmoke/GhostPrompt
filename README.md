# GhostPrompt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GhostPrompt](https://img.shields.io/badge/GhostPrompt-0.3.0-6366f1?style=flat)](https://github.com/jaminsmoke/GhostPrompt)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90%2B-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![GitHub Copilot](https://img.shields.io/badge/Uses-GitHub_Copilot-24292f?logo=github&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)

![GhostPrompt banner](./media/img/ghostpromp-Banner.png)

> Ghost-text completions for your Copilot prompts — write faster, think clearer.

<!-- markdownlint-disable-next-line MD036 -->
**Version 0.3.0**

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

---

## Requirements

- VS Code **1.90** or later
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension installed and signed in

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

### Model policy

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
- `ghostPrompt.requestCooldownMs` (default `500`)
- `ghostPrompt.cacheTtlMs` (default `45000`)
- `ghostPrompt.rateLimitMaxRequests` (default `90`)
- `ghostPrompt.rateLimitWindowMs` (default `600000`)
- `ghostPrompt.sessionRequestBudget` (default `300`)

### Debug mode

- Run command: `GhostPrompt: Toggle Debug`
- Output channel: `GhostPrompt Suggestions`
- Setting: `ghostPrompt.debugSuggestions`

Inside the webview mini-input, you can also change policy, style, context, and debug from the **control strip** (chips at the top). See **4 · Quick controls** in [Preview](#preview).

## Roadmap

v0.2 is **shipped**; roadmap documents:

- Archived v0.2: [`Docs/Plans/Roadmaps/Roadmap-v0.2.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.md)
- Current v0.2.2 execution: [`Docs/Plans/Roadmaps/Roadmap-v0.2.2.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.2.md)
- Unified session (Sidebar + Panel): [`Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md) *(complete)*
- **v0.3.0 — `src` layout & completion providers** *(architecture complete; additional 0.3.0 scope & VSIX packaging pending)*: [`Docs/Plans/Roadmaps/Roadmap-v0.3.0-architecture.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.0-architecture.md)
- Optional OpenCode backend (draft): [`Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md)

Full release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md).

---

## Release notes

### 0.3.0

- **Architecture:** `src/` split into layered folders (`completion/`, `host/`, `session/`, etc.) and a documented completion pipeline (`CompletionProvider`, Copilot LM adapter).
- **Maintainability:** completion logic divided into small modules (`instruction`, `normalize`, `modelCatalog`, …) ahead of optional alternate backends (see roadmap OpenCode).
- **Release process:** the distributable **VSIX** (and optional git tag `v0.3.0`) will be produced after the rest of the planned **0.3.0** work is merged—see [`CHANGELOG.md`](./CHANGELOG.md) *Notes* under 0.3.0 and the OpenCode roadmap.

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
