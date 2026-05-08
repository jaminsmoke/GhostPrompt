# Changelog

All notable changes to this project are documented in this file.

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
