# GhostPrompt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GhostPrompt](https://img.shields.io/badge/GhostPrompt-0.2.2-6366f1?style=flat)](https://github.com/jaminsmoke/GhostPrompt)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90%2B-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![GitHub Copilot](https://img.shields.io/badge/Uses-GitHub_Copilot-24292f?logo=github&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)

![GhostPrompt banner](./media/img/ghostpromp-Banner.png)

> Ghost-text completions for your Copilot prompts — write faster, think clearer.

<!-- markdownlint-disable-next-line MD036 -->
**Version 0.2.2**

---

## Why GhostPrompt

Writing prompts in Copilot Chat is often repetitive and context-switch heavy.  
**GhostPrompt** gives you an inline mini-composer inside VS Code with ghost-text suggestions, so you can draft faster and send to Copilot Chat without breaking flow.

### Benefits at a glance

- Faster prompt drafting with inline continuation suggestions
- Safer usage controls (non-premium policy, request governor)
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
- **Always visible** — the input lives in the Activity Bar sidebar *and* the bottom Panel; pick whichever fits your layout.
- **One-key send** — `Enter` sends your prompt to Copilot Chat. `Shift+Enter` adds a newline.
- **Request safety controls** — dedupe, cache, cooldown, rate-limit, and session budget to prevent over-calling.
- **Model policy controls** — force non-premium models by default, with optional override.
- **Non-intrusive** — completions run via `vscode.lm`; no draft editor tabs, no focus stealing.
- **Private logs** — accepted suggestions and sent prompts are saved in the extension's private storage (not inside your project).

---

## Requirements

- VS Code **1.90** or later
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension installed and signed in

---

## Quick start (30 seconds)

1. Open the **GhostPrompt** panel from the Activity Bar (chat-bubble icon) or from the bottom Panel tabs.
2. Start typing your prompt — after a short pause, a ghost-text continuation appears inline.
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

- `ghostPrompt.suggestionModelPolicy = nonPremiumOnly` (default): only non-premium-like models are allowed.
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

Full release history is maintained in [`CHANGELOG.md`](./CHANGELOG.md).

---

## Release notes

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
- **Model policy**: default **non-premium** selection with optional `anyModel` override; commands and settings for policy/debug.
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
