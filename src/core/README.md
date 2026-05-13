# `core/` — Lógica pura de suggestions

> Dominio canónico que contiene toda la lógica de negocio independiente de VS Code, webview UI y motores específicos.

---

## Rol

`core/` es el **corazón** de GhostPrompt. Contiene la lógica pura de suggestions: tipos, instrucción del LM, normalización, streaming, resolución de idioma, estados de loading, fuentes de completion, catálogo unificado, gobernador de peticiones, sesión compartida y orquestación del pipeline.

**No debe contener:**
- Integración con VS Code API (`vscode.workspace`, `vscode.window`, `WebviewViewProvider`)
- HTML/CSP generation
- Protocolos de mensajes webview↔host (eso es `api/`)
- Implementaciones de motores específicos (eso es `engines/`)

---

## Estructura

```
core/
├── types.ts                          # Tipos canónicos: SuggestionModelDescriptor, CompletionResult, etc.
├── instruction.ts                    # Construcción de instrucciones para el LM (style, context, language)
├── normalize.ts                      # Normalización de texto de suggestion (overlap, spacing, boundaries)
├── streaming.ts                      # Utility para consumir streams de texto async
├── language.ts                       # Detección y resolución de idioma de suggestion
├── loading.ts                        # Fases de loading y status text (`SuggestionLoadingPhase`)
├── sources.ts                        # Resolución de fuentes: enabled, routing, UI kind
├── index.ts                          # Barrel público (re-exports de todo el dominio)
├── catalog/
│   └── mergedModelCatalog.ts         # Catálogo unificado: Copilot + OpenCode + Ollama
├── governor/
│   └── SuggestionRequestGovernor.ts  # Governor: dedupe, cache, cooldown, rate limit, budget
├── session/
│   └── GhostPromptSessionStore.ts    # Estado compartido: draft, pending suggestion, captureId, cancel token
├── context/
│   └── projectBootstrapContext.ts    # Contexto del proyecto: README, package.json, bootstrap lines
└── pipeline/
    ├── suggestPipeline.ts            # Orquestación completa: governor → LM → broadcast
    └── index.ts                      # Barrel del pipeline
```

---

## Flujo del pipeline

```
User types → debounce → `suggest` message
    │
    ▼
`core/pipeline/suggestPipeline.ts`
    ├── Governor.decide (cache hit / block / proceed)
    ├── Resolve completion source (copilot / opencode / ollama)
    ├── Collect project context (if contextMode=project)
    ├── GetCompletionProviderForSource(source).requestCompletion(...)
    │       ├── Copilot: vscode.lm → sendRequest
    │       ├── OpenCode: API client → session.prompt
    │       └── Ollama: HTTP POST /api/generate
    └── Broadcast UI: loading → suggestion | empty | error
```

---

## Contratos clave

### `CompletionResult`

```ts
type CompletionResult =
  | { kind: "suggestion"; suggestion: string; model?: SuggestionModelDescriptor }
  | { kind: "empty"; reason: EmptyReason }
  | { kind: "error"; message: string };
```

### `SuggestionLoadingPhase`

```ts
type SuggestionLoadingPhase =
  | "copilot" | "opencode-start" | "opencode-stream" | "opencode-done"
  | "ollama-start" | "ollama-generating";
```

### `CompletionProvider` (definido en `engines/`, consumido aquí)

```ts
interface CompletionProvider {
  id: string;
  requestCompletion(text: string, opts: CompletionOptions): Promise<CompletionResult>;
}
```

---

## Dependencias

| Importa de | Por qué |
|------------|---------|
| `engines/engineRegistry` | `getCompletionProviderForSource` para obtener el motor activo |
| `engines/*/catalog/*` | Listados de modelos (Copilot, OpenCode, Ollama) |
| `system/debug/SuggestionDebug` | Logging de debug para perf capture |
| `vscode/suggestionNotification` | Notificaciones host para fallos accionables |
| `api/protocols/webviewProtocols` | Tipo `WebviewInboundMessage` |

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `CopilotCompletion.test.ts` | Flujo completo de suggestion con Copilot LM |
| `SuggestionRequestGovernor.test.ts` | Cache, cooldown, rate limit, budget |
| `GhostPromptSessionStore.test.ts` | Estado compartido, cancel tokens, captureId |
| `completionInstruction.test.ts` | Construcción de instrucciones LM |
| `instructionNormalizeContract.test.ts` | Contrato instruction → normalize |
| `loading.test.ts` | Status text por fase de loading |
| `completionSources.test.ts` | Routing de fuentes, `looksLikeOllamaModelId` |
| `mergedModelCatalog.test.ts` | Merge + dedup de catálogos multi-fuente |
| `projectBootstrapContext.test.ts` | Bootstrap lines, fingerprint |
| `host/ghostPromptSuggestPipeline.test.ts` | Pipeline completo con mocks |
