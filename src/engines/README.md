# `engines/` — Motores de completion

> Dominio canónico que contiene todos los motores de suggestion: Copilot LM, OpenCode y Ollama.

---

## Rol

`engines/` expone adaptadores LM por proveedor (`EngineProvider`: `id` + `requestCompletion`). El routing elige fuente (`resolveCompletionSourceForRequest`) y adaptador (`resolveProvider`). Por modelo: `model:tag` → Ollama, `providerID/modelID` → OpenCode, id de chat Copilot → LM.

Las sugerencias con `kind: 'suggestion'` salen **del motor como texto crudo** del LM (salvo respuestas vacías factuales en algunos proveedores). La acotación (`ghostPrompt.maxSuggestionChars`) y la heurística de rechazo (`content-blocked`) se aplican en `system/runtime/suggest/finalizeEngineCompletionResult`, llamado desde `runGhostPromptSuggestPipeline`.

**No debe contener:**

- Lógica de orquestación del pipeline (eso es `system/runtime/`)
- Gestión de vistas VS Code (eso es `vscode/`)
- Protocolos de mensajes webview (eso es `api/`)

---

## Estructura

```text
engines/
├── index.ts                     # Barrel público delgado
├── completion/
│   ├── buildCompletionInstruction.ts  # Prompt LM compartido (Copilot, OpenCode, Ollama)
│   └── index.ts
├── runtime/
│   └── providerStatusRegistry.ts  # Registro de *Status → `system/runtime/providers/providerStatusManager`
├── config/
│   └── completionSources.ts     # getEnabledCompletionSources, getCompletionUiKind (VS Code settings)
├── routing/
│   ├── resolveCompletionSource.ts  # resolveCompletionSourceForRequest (modelo → fuente)
│   └── resolveProvider.ts          # resolveProvider (fuente → adaptador LM)
└── provider/
    ├── mergedModelCatalog.ts    # Lista unificada multi-proveedor (settings/UI)
    ├── copilot/                 # completion/, lm/, host/, catalog/, vscode.lm
    ├── opencode/                # server/, client/, opencodeSdkBootstrap, opencodeCompletionFetch, opencodeCompletionEngine, routingModelId
    └── ollama/                  # http/, host/, completion/, routing/, catalog/
```

---

## Patrón `EngineProvider`

```ts
interface EngineProvider {
  id: string;
  requestCompletion(text: string, opts: CompletionRequestOptions): Promise<CompletionResult>;
}
```

### Resolución

```ts
resolveProvider('copilot'); // → copilotLm
resolveProvider('opencode'); // → opencode
resolveProvider('ollama'); // → ollama
```

---

## Routing por modelo

| Patrón de modelo     | Motor        | Ejemplo                       |
| -------------------- | ------------ | ----------------------------- |
| Id de chat Copilot   | `copilotLm`  | `gpt-4o-mini`                 |
| `providerID/modelID` | `opencodeLm` | `openai/gpt-4`                |
| `model:tag`          | `ollamaLm`   | `mistral:latest`, `llama3:7b` |

Función clave: `resolveCompletionSourceForRequest(selectedModelId, enabledSources)` en `routing/resolveCompletionSource.ts`.
Configuración de fuentes habilitadas: `config/completionSources.ts` (`ghostPrompt.enabledCompletionSources` / legacy `completionProvider`).

---

## Motores

### Copilot LM (`copilot/`)

- **API:** `vscode.lm.selectChatModels` + `sendRequest`
- **Requisitos:** GitHub Copilot instalado y signed in
- **`completion/`** — `requestCopilotLmCompletion` (`copilotCompletionEngine.ts`)
- **`lm/`** — `collectLmResponse` (stream LM VS Code)
- **`host/`** — `copilotHostStatusModule` → `ProviderStatusModule`
- **Catálogo:** `catalog/modelCatalog.ts` lista modelos disponibles via `vscode.lm`
- **Sin configuración adicional:** usa la sesión activa de Copilot

### OpenCode (`opencode/`)

- **API:** `@opencode-ai/sdk` (dynamic import ESM)
- **Conexión:** HTTP a instancia OpenCode ya corriendo (default `http://127.0.0.1:4096`)
- **Auth:** `ghostPrompt.opencodeAuthToken` (Bearer token, optional)
- **Session pool:** TTL 5 min, max 4 sesiones, reutilización automática
- **Health check:** `client.config.get()` antes de cada request
- **Catálogo:** `config.providers()` on-demand, cacheado por sesión
- **Streaming:** SSE preview opcional con `promptStreamOpenCode`

### Ollama (`ollama/`)

- **`http/`** — REST `/api/tags`, `/api/generate`, tipos y validadores Zod (`ollamaApiClient`, `ollamaValidators`, `ollamaTypes`).
- **`host/`** — CLI y proceso (`ollamaModelManager`, `ollamaHostStatusModule` → `ProviderStatusModule`).
- **`completion/`** — `requestOllamaCompletion` → `CompletionResult`.
- **`routing/`** — heurística `model:tag` para `resolveCompletionSource`.
- **`catalog/`** — lista y normalización para el selector webview.

---

## Dependencias

| Importa de                  | Por qué                                               |
| --------------------------- | ----------------------------------------------------- |
| `system/internals/protocols/types` | `SuggestionModelDescriptor`, `CompletionResult`, etc. |
| `engines/completion/`          | `buildCompletionInstruction` para el prompt del LM    |
| `copilot/lm/collectLmResponse`       | `collectLmResponse` (stream LM VS Code)         |
| `system/internals/protocols/state/loading` | `SuggestionLoadingPhase`, textos de fase    |
| `engines/runtime/providerStatusRegistry` | Registro de módulos *Status en el host |
| `system/internals/protocols/state`   | Tipos de sesión y loading                         |
| `system/log`                | Logging estructurado y perf capture                   |

---

## Tests relevantes

| Test                                      | Qué cubre                                                          |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `http/ollamaApiClient.test.ts`           | Mock fetch, listModels, generate                                   |
| `http/ollamaValidators.test.ts`          | Esquemas Zod respuestas Ollama                                     |
| `host/ollamaHostStatusModule.test.ts`    | Estado CLI (`ProviderStatusModule`)                                |
| `completion/ollamaCompletionEngine.test.ts` | Modelo explícito, auto-resolve, exclusiones, errores, fases |
| `completion/copilotCompletionEngine.test.ts` | Copilot LM: modelo vacío, timeout, políticas, catálogo |
| `copilot/lm/collectLmResponse.test.ts`       | Stream texto LM VS Code (Copilot)                                  |
| `routing/routingModelId.test.ts`        | Heurística `model:tag`                                             |
| `catalog/ollamaModelCatalog.test.ts`    | Lista modelos UI, fallback no disponible                           |
| `client/opencodeClient.test.ts`           | Session pool, health check, prompt, promptStream                   |
| `opencodeCompletionEngine.test.ts`        | Request completion con OpenCode                                      |
| `opencodeModelCatalog.test.ts`            | Lista modelos, snapshot cache, exclusión                           |
| `opencodeModelTier.test.ts`               | Clasificación de tiers por pricing metadata                        |
| `normalizeOpencodeProviderModels.test.ts` | Normalización array vs mapa de modelos                             |
| `mergedModelCatalog.test.ts`              | Merge + dedup de catálogos multi-fuente                            |
