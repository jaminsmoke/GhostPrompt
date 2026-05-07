# GhostPrompt

> Ghost-text completions for your Copilot prompts — write faster, think clearer.

---

## What it does

**GhostPrompt** embeds a small input panel inside VS Code — in both the Activity Bar and the bottom Panel — where you can type prompts and get real-time Copilot completions as you write, just like ghost-text in an editor.

Once you're happy with your prompt, press **Enter** and it goes straight to GitHub Copilot Chat.

---

## Features

- **Ghost-text completions** — as you type, Copilot suggests how to continue your prompt. Press `Tab` to accept.
- **Always visible** — the input lives in the Activity Bar sidebar *and* the bottom Panel; pick whichever fits your layout.
- **One-key send** — `Enter` sends your prompt to Copilot Chat. `Shift+Enter` adds a newline.
- **Non-intrusive** — completions are fetched in the background via the `vscode.lm` API; no editor windows are opened, no focus is stolen.
- **Private logs** — accepted suggestions and sent prompts are saved in the extension's private storage (not inside your project).

---

## Requirements

- VS Code **1.90** or later
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension installed and signed in

---

## Usage

1. Open the **GhostPrompt** panel from the Activity Bar (chat-bubble icon) or from the bottom Panel tabs.
2. Start typing your prompt — after a short pause, a ghost-text completion appears below the input.
3. Press `Tab` to accept the suggestion and append it to your prompt.
4. Press `Enter` to send the final prompt to **Copilot Chat**.

### Suggestion model policy

GhostPrompt includes a safety setting to control which models can be used for inline suggestions:

- `ghostPrompt.suggestionModelPolicy = nonPremiumOnly` (default): only non-premium-like models are allowed.
- `ghostPrompt.suggestionModelPolicy = anyModel`: uses the first available model (may consume premium quota).

### Debug mode

- Run command: `GhostPrompt: Toggle Debug`
- Output channel: `GhostPrompt Suggestions`
- Setting: `ghostPrompt.debugSuggestions`

Optional tuning:

- `ghostPrompt.maxSuggestionChars` (default `180`)
- `ghostPrompt.suggestionStyle` (`concise` | `balanced` | `detailed`, default `balanced`)
- `ghostPrompt.contextMode` (`off` | `basic`, default `basic`)
- `ghostPrompt.minCharsForSuggestion` (default `6`)
- `ghostPrompt.requestCooldownMs` (default `700`)
- `ghostPrompt.cacheTtlMs` (default `45000`)
- `ghostPrompt.rateLimitMaxRequests` (default `40`)
- `ghostPrompt.rateLimitWindowMs` (default `600000`)
- `ghostPrompt.sessionRequestBudget` (default `120`)

Inside the webview mini-input, you can also configure policy/style/context/debug from the `Opciones` menu.

### Keyboard shortcuts

| Key           | Action                                   |
| ------------- | ---------------------------------------- |
| `Tab`         | Accept the current ghost-text suggestion |
| `Enter`       | Send prompt to Copilot Chat              |
| `Shift+Enter` | Insert a newline in the prompt           |

---

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch the Extension Development Host
```

Run full validation before committing:

```bash
npm run validate   # lint + compile
npm run test       # unit/integration tests with vitest
npm run check      # validate + tests
```

---

## Known limitations (v0.1)

- Completions require a Copilot model to be available; if no model is found the ghost-text area stays empty.
- The conversation history and accepted suggestions log are not yet exposed in the UI (coming in v0.2).

---

## Release notes

### 0.0.1

Initial release: dual-panel registration (Activity Bar + bottom Panel), ghost-text completions via `vscode.lm`, Tab-to-accept, Enter-to-send.

---

## License

MIT
