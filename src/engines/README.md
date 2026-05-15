# `engines/` — Motores de completion

> Dominio canónico que contiene todos los motores de suggestion: Copilot LM, OpenCode y Ollama.

---

## Rol

`engines/` expone adaptadores LM por proveedor (`EngineProvider`: `id` + `requestCompletion`). El routing elige fuente (`resolveCompletionSourceForRequest`) y adaptador (`resolveProvider`). Por modelo: `model:tag` → Ollama, `providerID/modelID` → OpenCode, id de chat Copilot → LM.

**No debe contener:**

- Lógica de orquestación del pipeline (eso es `system/runtime/`)
- Gestión de vistas VS Code (eso es `vscode/`)
- Protocolos de mensajes webview (eso es `api/`)

---

## Estructura

```text
engines/
├── index.ts                     # Barrel público delgado
├── runtime/
│   └── providerStatusRegistry.ts  # Registro de *Status → `system/runtime/providerStatusManager`
├── config/
│   └── completionSources.ts     # getEnabledCompletionSources, getCompletionUiKind (VS Code settings)
├── routing/
│   ├── resolveCompletionSource.ts  # resolveCompletionSourceForRequest (modelo → fuente)
│   └── resolveProvider.ts          # resolveProvider (fuente → adaptador LM)
└── provider/
    ├── mergedModelCatalog.ts    # Lista unificada multi-proveedor (settings/UI)
    ├── copilot/                 # LM Copilot (vscode.lm)
    ├── opencode/                # server/, opencodeCompletion, opencodeLmEngine
    └── ollama/                  # Ollama HTTP /api/generate
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
- **Catálogo:** `modelCatalog.ts` lista modelos disponibles via `vscode.lm`
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

- **API:** HTTP REST directo (sin SDK)
- **Endpoints:** `GET /api/tags` (list models), `POST /api/generate` (completion)
- **Base URL:** `ghostPrompt.ollamaBaseUrl` (default `http://localhost:11434`)
- **Offline-first:** no requiere API key ni cloud dependency
- **Streaming:** soporte SSE en `/api/generate` con `stream: true`
- **Catálogo:** `/api/tags` con normalización de metadatos

---

## Dependencias

| Importa de                  | Por qué                                               |
| --------------------------- | ----------------------------------------------------- |
| `sugcore/types`                | `SuggestionModelDescriptor`, `CompletionResult`, etc. |
| `sugcore/rules/instruction`    | `buildCompletionInstruction` para el prompt del LM    |
| `copilot/collectLmResponse`          | `collectLmResponse` (stream LM VS Code)         |
| `system/internals/protocols/state/loading` | `SuggestionLoadingPhase`, textos de fase    |
| `engines/runtime/providerStatusRegistry` | Registro de módulos *Status en el host |
| `system/internals/protocols/state`   | Tipos de sesión y loading                         |
| `system/log`                | Logging estructurado y perf capture                   |

---

## Tests relevantes

| Test                                      | Qué cubre                                                          |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `engineRegistry.test.ts`                  | Registro y resolución de proveedores                               |
| `ollamaApiClient.test.ts`                 | Mock fetch, listModels, generate (éxito, error, custom baseUrl)    |
| `ollamaLmEngine.test.ts`                  | Modelo explícito, auto-resolve, exclusión, errores, loading phases |
| `client/opencodeClient.test.ts`           | Session pool, health check, prompt, promptStream                   |
| `opencodeLmCompletion.test.ts`            | Request completion con OpenCode, streaming preview                 |
| `opencodeModelCatalog.test.ts`            | Lista modelos, snapshot cache, exclusión                           |
| `opencodeModelTier.test.ts`               | Clasificación de tiers por pricing metadata                        |
| `normalizeOpencodeProviderModels.test.ts` | Normalización array vs mapa de modelos                             |
| `mergedModelCatalog.test.ts`              | Merge + dedup de catálogos multi-fuente                            |
