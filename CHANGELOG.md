# Changelog

All notable changes to this project are documented in this file.

## [0.3.1] - 2026-05-09

### Added

- **Webview protocols:** Zod validation at host boundaries (`src/host/webviewProtocols.ts`), dependency **`zod`**; inbound/outbound message parsing in `MiniInputViewProvider`.
- **Tests:** `webviewProtocols.test.ts`, `webviewToolbarParity.test.ts`, `webviewThemeTokens.test.ts`; dual-view `refreshSettingsAllViews` regression.

### Changed

- **Toolbar UX:** Style, context, and language controls grouped in a **`<details>`** menu (`compose-options-details`) with live summary text; `Escape` closes the menu; chip click closes after selection.
- **Theming:** Webview CSS avoids hardcoded error color fallbacks; widget borders fall back to `transparent` when tokens are absent.

### Docs

- [`Roadmap-v0.3.1-webview-parity-contracts-ux.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md): Phases A–D (parity, contracts, compose menu, QA manual RC).
- README: version badge **0.3.1**.

## [0.3.0] - 2026-05-09

### Added

- **OpenCode (optional backend):** `ghostPrompt.completionProvider` (`copilot` | `opencode`), dedicated embedded OpenCode server (default loopback port **17433**), CLI probe (`opencode --version`), `providers/opencodeLmCompletion`, webview model list from `config.providers()`, `ghostPrompt.opencodeExcludedModelIds`, and a **Motor:** badge (Copilot LM vs OpenCode). Depends on [`@opencode-ai/sdk`](https://www.npmjs.com/package/@opencode-ai/sdk); see [OpenCode docs](https://opencode.ai/docs/sdk).
- **Tests (no network):** `tests/opencodeModelCatalog.test.ts`, `tests/opencodeLmCompletion.test.ts` mock `OpenCodeRuntime` / SDK envelope responses.

### Changed

- **Extension host layout:** `src/` reorganized into `extension/`, `host/`, `session/`, `completion/`, `governor/`, `bridge/`, `log/`, `debug/`; package entry `out/extension/extension.js`.
- **Completion domain:** split monolith into `types`, `instruction`, `normalize`, `language`, `streaming`, `modelCatalog`, `providers/copilotLmCompletion`, `completionProvider`; public barrel `src/completion/index.ts` (historical imports from `CopilotCompletion` path removed — use `../completion`).
- **Pluggable completions:** `CompletionProvider` + `getActiveCompletionProvider()` + `getCompletionProviderKind()`; `MiniInputViewProvider` delegates to Copilot LM or OpenCode and refreshes model chips when `ghostPrompt.*` changes.
- **VSIX packaging:** `npm run vsix` runs `vsce package` **with** dependencies so `@opencode-ai/sdk` ships inside the VSIX.

### Docs

- `ARCHITECTURE.md`, `Roadmap-v0.3.0-architecture.md`: Phases A–C (structure + refactor + release).
- README: completion provider section, OpenCode prerequisites, settings reference.
- [`Roadmap-v0.3-opencode-integration.md`](./Docs/Plans/Roadmaps/Roadmap-v0.3-opencode-integration.md): Phases 1–4 completed.

### Notes

- **Git tag:** annotated tag `v0.3.0` remains optional until you cut the release; the VSIX can be built anytime with `npm run vsix`.

## [0.2.5] - 2026-05-09

### Added

- `GhostPromptSessionStore` as single host source of truth for draft, pending suggestion, flow status, capture id, and shared cancellation across Sidebar + Panel webviews.
- Webview sync protocol: `draftChanged` / `draftSync` / `draftHydrate`, `broadcast` suggestion UI (`loading`, suggestion, empty/error, effective language).
- Optional `window.__ghostPromptCapabilities` (injected HTML) with `compactToolbar` CSS hook for future layout tweaks without breaking default parity.

### Changed

- Both GhostPrompt surfaces now mirror settings and suggestion state immediately (`_broadcastSettingsToAllViews`, `_broadcastUi`).
- Control strip uses flex wrap and full-width hints for narrow sidebar/panel widths; debug chip `aria-label` / `aria-pressed`.
- `suggestionStyleDirective()` exposes stable `STYLE_CONCISE` / `STYLE_BALANCED` / `STYLE_DETAILED` instruction fragments; `buildCompletionInstruction` consumes them.

### Docs

- README and roadmap `v0.2.4b` updated for unified session; Sprint 6 smoke checklist in [`Roadmap-v0.2.4b.md`](./Docs/Plans/Roadmaps/Roadmap-v0.2.4b.md).

## [0.2.4] - 2026-05-08

### Added

- Runtime pricing metadata exposure in suggestion model descriptors (`pricing`, e.g. `0x`, `0.33x`, `1x`) for UI transparency.
- Included/Premium/Unknown tier rendering in webview model selector and runtime model label.
- Loading spinner in status line while a suggestion request is in progress (`Buscando sugerencia...`).

### Changed

- Model tier classification now prioritizes passive pricing metadata (no active model probing required).
- Safe policy behavior (`nonPremiumOnly`) now targets included models (`pricing=0x`) when metadata exists, with conservative fallback.
- Empty reason terminology updated from `no-non-premium-model` to `no-included-model`.
- Model selector deduplicates repeated entries that resolve to the same visible model/tier/pricing combination.
- Model selector options are grouped by inferred provider and sorted for faster scanning.
- Tier visualization refined for readability using compact textual tokens (`[INCLUDED 0x]`, `[PREMIUM 1x]`, `[UNKNOWN]`) instead of dot indicators.
- Slow or stalled model responses now fail gracefully with timeout feedback instead of indefinite loading.
- Suggestion preview/accept flow now treats host normalization as the single source of truth, removing extra spacing heuristics in webview that could split words (`apli cacion`-style artifacts).
- Completion instruction now explicitly guides leading-space behavior: add one space for a new word, keep no leading space when completing an unfinished word.
- Product version bumped to `0.2.4`.

### Known issues

- `gpt-5-mini` and `raptor` may timeout in some sessions and return no suggestion. GhostPrompt now exits cleanly from loading state and shows a retry/model-switch hint.

### Docs

- README updated for `0.2.4` with pricing-aware tier behavior and terminology alignment.
- Debug guide updated to reflect `no-included-model`.
- Development audit tooling documented as isolated under `Scripts/` (not part of packaged extension).

## [0.2.3] - 2026-05-08

### Added (0.2.2)

- Model selector redesign in webview with explicit per-model tier labels (`Included` / `Premium`).
- Runtime model status label in webview (`Modelo: ... [Included/Premium]`).
- Scoped governor key dimensions to avoid cache collisions across language/style/context/model settings.

### Changed (0.2.2)

- Suggestion boundary normalization after punctuation (`:`, `;`, `,`, `.`, `!`, `?`) for cleaner inline continuation spacing.
- Language auto-resolution stability with confidence-aware detection, hysteresis, and fallback to previous/manual language.
- Preferred model selection persisted via `ghostPrompt.selectedModelId` and respected by model selection policy.

### Validation (0.2.2)

- `npm run check` passing (`lint` + `compile` + `test`).
- VSIX packaging verified for `ghost-prompt-0.2.3.vsix`.

## [0.2.2] - 2026-05-08

### Added

- Project-aware context mode (`ghostPrompt.contextMode=project`) including workspace, active file/language, and selection excerpts.
- Suggestion language controls:
  - `ghostPrompt.suggestionLanguageMode` (`auto` | `manual`)
  - `ghostPrompt.suggestionLanguage` (`es` | `en`)
- Language selector chips in webview (`Auto`, `ES`, `EN`) with effective-language feedback in auto mode.
- New roadmap for v0.2.2 in `Docs/Plans/Roadmaps/Roadmap-v0.2.2.md`.
- Additional tests for language detection/precedence and host-webview flow.

### Changed

- Request governor defaults tuned for longer sessions:
  - `requestCooldownMs`: `700 -> 500`
  - `rateLimitMaxRequests`: `40 -> 90`
  - `sessionRequestBudget`: `120 -> 300`
- Completion instruction now enforces output language and prevents translation of code identifiers/paths/API names.
- Ghost-text pipeline improved:
  - overlap and partial-word normalization in completion output
  - safer punctuation/spacing boundary handling when accepting with `Tab`
  - inline preview aligned with inserted text behavior
- README media paths updated to `media/img/*` and banner integrated.

### Fixed (0.2.1)

- Reduced cases where ghost suggestion text appeared glued to previous words.
- Improved consistency between inline rendering and accepted insertion output.

### Validation

- `npm run check` passing (`lint` + `compile` + `test`).

## [0.2.1] - 2026-05-07

### Fixed

- Ghost UI spacing/focus fixes and suggestion normalization refinements.

## [0.2.0] - 2026-05-07

### Added (0.2.0)

- Inline ghost-text suggestions in the webview mini composer.
- Request governor (dedupe, cache, cooldown, rate limit, session budget).
- Suggestion style controls and session context controls.
- Debug tooling and test suite baseline.

## [0.0.1] - Initial release

- Dual-panel registration and first ghost-text completion flow via `vscode.lm`.
