# `engines/` — Motores de completion

> Dominio canónico que contiene todos los motores de suggestion: Copilot LM, OpenCode y Ollama.

---

## Rol

`engines/` implementa el patrón **`CompletionProvider`**. Cada motor expone una interfaz común (`id` + `requestCompletion`) y se registra en el `engineRegistry`. El routing se resuelve por el modelo seleccionado: `model:tag` → Ollama, `providerID/modelID` → OpenCode, id de chat Copilot → LM.

**No debe contener:**
- Lógica de orquestación del pipeline (eso es `core/pipeline/`)
- Gestión de vistas VS Code (eso es `vscode/`)
- Protocolos de mensajes webview (eso es `api/`)

---

## Estructura

```
engines/
├── engineRegistry.ts            # Registro de motores + getCompletionProviderForSource
├── copilot/
│   ├── copilotLmEngine.ts       # Motor Copilot LM (vscode.lm)
│   └── catalog/
│       └── modelCatalog.ts      # Catálogo de modelos Copilot
├── opencode/
│   ├── opencodeApiClient.ts     # Cliente API: createOpenCodeClient, health check, session pool
│   ├── opencodeLmEngine.ts      # Motor OpenCode (session.prompt)
│   └── catalog/
│       ├── opencodeModelCatalog.ts    # Lista modelos via config.providers()
│       └── opencodeModelTier.ts       # Clasificación de tiers (included/premium/unknown)
└── ollama/
    ├── ollamaApiClient.ts       # Cliente HTTP REST: listModels, generate
    ├── ollamaLmEngine.ts        # Motor Ollama (POST /api/generate)
    ├── ollamaTypes.ts           # Tipos de respuesta de Ollama
    └── catalog/
        ├── ollamaModelCatalog.ts      # Lista modelos via /api/tags
        └── normalizeOllamaModels.ts   # Normalización de metadatos Ollama
```

---

## Patrón `CompletionProvider`

```ts
interface CompletionProvider {
  id: string;
  requestCompletion(text: string, opts: CompletionOptions): Promise<CompletionResult>;
}
```

### Registro

```ts
// En cada motor:
registerCompletionProvider("copilotLm", { id: "copilotLm", requestCompletion: ... });
registerCompletionProvider("opencodeLm", { id: "opencodeLm", requestCompletion: ... });
registerCompletionProvider("ollamaLm", { id: "ollamaLm", requestCompletion: ... });
```

### Resolución

```ts
getCompletionProviderForSource("copilot");  // → copilotLm provider
getCompletionProviderForSource("opencode"); // → opencodeLm provider
getCompletionProviderForSource("ollama");   // → ollamaLm provider
```

---

## Routing por modelo

| Patrón de modelo | Motor | Ejemplo |
|------------------|-------|---------|
| Id de chat Copilot | `copilotLm` | `gpt-4o-mini` |
| `providerID/modelID` | `opencodeLm` | `openai/gpt-4` |
| `model:tag` | `ollamaLm` | `mistral:latest`, `llama3:7b` |

Función clave: `resolveCompletionSourceForRequest(selectedModelId, enabledSources)` en `core/sources.ts`.

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

| Importa de | Por qué |
|------------|---------|
| `core/types` | `SuggestionModelDescriptor`, `CompletionResult`, etc. |
| `core/instruction` | `buildCompletionInstruction` para el prompt del LM |
| `core/normalize` | `normalizeSuggestion` para post-proceso |
| `core/streaming` | `consumeTextStream` para streaming |
| `core/loading` | `SuggestionLoadingPhase` para feedback UI |
| `system/debug/SuggestionDebug` | Logging de debug y perf capture |

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `engineRegistry.test.ts` | Registro y resolución de proveedores |
| `ollamaApiClient.test.ts` | Mock fetch, listModels, generate (éxito, error, custom baseUrl) |
| `ollamaLmEngine.test.ts` | Modelo explícito, auto-resolve, exclusión, errores, loading phases |
| `opencodeApiClient.test.ts` | Session pool, health check, prompt, promptStream |
| `opencodeLmCompletion.test.ts` | Request completion con OpenCode, streaming preview |
| `opencodeModelCatalog.test.ts` | Lista modelos, snapshot cache, exclusión |
| `opencodeModelTier.test.ts` | Clasificación de tiers por pricing metadata |
| `normalizeOpencodeProviderModels.test.ts` | Normalización array vs mapa de modelos |
| `mergedModelCatalog.test.ts` | Merge + dedup de catálogos multi-fuente |
