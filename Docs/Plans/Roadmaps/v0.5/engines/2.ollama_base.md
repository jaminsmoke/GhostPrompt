# Roadmap v0.5.1 — Ollama engine integration

> **State:** shipped (2026-05-13)
> **Goal:** Add Ollama as a third completion engine alongside Copilot LM and OpenCode, and canonicalise engine adapters under `src/engines/`.

---

## Overview

| Phase | Scope | Status | PR | Date |
|-------|-------|--------|----|------|
| **1** | Structure `src/engines/` — migrate Copilot + OpenCode adapters | 🟢 | — | 2026-05-13 |
| **2** | Ollama API client (`ollamaTypes`, `ollamaApiClient`) | 🟢 | — | 2026-05-13 |
| **3** | Ollama engine adapter (`ollamaLmEngine`, loading phases, engine registry) | 🟢 | — | 2026-05-13 |
| **4** | Ollama model catalog, routing, settings `package.json`, Zod schemas | 🟢 | — | 2026-05-13 |
| **5** | Webview UI — motor selector, provider grouping, Ollama chip | 🟢 | — | 2026-05-13 |
| **6** | Unit tests (client, engine, catalog, routing, registry) | 🟢 | — | 2026-05-13 |
| **7** | Documentation (ARCHITECTURE, matrix, Owners, CHANGELOG) | 🟢 | — | 2026-05-13 |

---

## Detail

### Phase 1 — Engine structure

- Created `src/engines/copilot/`, `src/engines/opencode/`, `src/engines/ollama/`
- Moved `copilotLmCompletion.ts` → `copilotLmEngine.ts`
- Moved `opencodeLmCompletion.ts` → `opencodeLmEngine.ts`
- `engineRegistry.ts` with `CompletionProvider` interface and `getCompletionProviderForSource()`
- `completionProvider.ts` becomes a re-export wrapper
- Old `completion/providers/` deleted

### Phase 2 — Ollama API client

- `ollamaTypes.ts`: `OllamaGenerateRequest`, `OllamaGenerateResponse`, `OllamaModel`, `OllamaTagsResponse`, etc.
- `ollamaApiClient.ts`: `listModels()` → `GET /api/tags`; `generate()` → `POST /api/generate` (streaming via SSE with `onStreamPreview`, non-streaming fallback)
- Config getters: `getGhostPromptOllamaBaseUrl`, `getGhostPromptOllamaExcludedModelIds`

### Phase 3 — Ollama engine adapter

- `ollamaLmEngine.ts`: `requestOllamaCompletion()` — auto-resolve model from `listModels`, respect `ollamaExcludedModelIds`, call `generate()`, normalise suggestion
- Loading phases: `"ollama-start"`, `"ollama-generating"` in `suggestionLoadingUi.ts`
- Registration in `engineRegistry.ts`
- Routing in `completionSources.ts`: `looksLikeOllamaModelId` detects `model:tag` pattern (`:` without `/`)

### Phase 4 — Catalog, settings, schemas

- `normalizeOllamaModels.ts`: normalise `/api/tags` response to `SuggestionModelDescriptor[]`
- `ollamaModelCatalog.ts`: `listOllamaSuggestionModels()` with exclusion filter
- `mergedModelCatalog.ts`: includes `ollama` source
- `package.json`: `ollamaBaseUrl`, `ollamaExcludedModelIds`, enum values for `completionProvider`/`enabledCompletionSources`
- Zod schemas in `webviewMessageSchemas.ts`: `"ollama"` everywhere

### Phase 5 — Webview UI

- `<option value="ollama">Ollama</option>` in `webview/index.html`
- Change handler and settings handler accept `"ollama"`
- Provider grouping: Ollama bucket between OpenCode and Other
- Sorting: Copilot → OpenCode → Ollama → Other

### Phase 6 — Tests

| Test file | Coverage |
|-----------|----------|
| `tests/ollamaApiClient.test.ts` | `listModels`, `generate` (mock fetch) |
| `tests/ollamaLmEngine.test.ts` | `requestOllamaCompletion` (mock api client) |
| `tests/completionSources.test.ts` | `+5` tests: ollama legacy, enabled sources, routing, `looksLikeOllamaModelId` |
| `tests/mergedModelCatalog.test.ts` | Merge with ollama models, dedup, error propagation |
| `tests/engineRegistry.test.ts` | `getCompletionProviderForSource` with ollama |

Total: **230 tests** (+35 new).

---

## Key design decisions

- **`engines/` as canonical adapter folder** — separates adapters from shared completion infrastructure
- **Ollama model IDs are literal** (`"mistral:latest"`) — no `"ollama/"` prefix
- **Routing by pattern**: `model:tag` → Ollama, `providerID/modelID` → OpenCode
- **No embedded process** — user runs `ollama serve` independently; GhostPrompt uses HTTP REST only
- **All Ollama models are `"included"` tier** — local inference has no usage cost

---

## References

- Full integration roadmap: [`Roadmap-v0.5.1-ollama-integration.md`](./Roadmap-v0.5.1-ollama-integration.md)
- Architecture: [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Engine registry: `src/engines/engineRegistry.ts`
- Ollama client: `src/engines/ollama/ollamaApiClient.ts`
- Ollama engine: `src/engines/ollama/ollamaLmEngine.ts`
