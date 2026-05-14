# Roadmap v0.5.4 — Auditoría de timeouts y loading phases en engines

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Contexto

Los tres engines (Copilot, OpenCode, Ollama) tienen un timeout único de `DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 12000ms` que comienza desde que **entra** a la función del engine, no desde que el modelo realmente empieza a generar. Esto provoca falsos timeouts cuando:

- Copilot tarda en `selectChatModels` + `buildCompletionInstructionParts`
- OpenCode tarda en health check + session pool
- Ollama carga el modelo en memoria por primera vez (puede tardar 20-30s)

Además, los loading phases no reflejan el estado real del engine: no hay fase que indique "cargando modelo" vs "generando".

### Problema

- Timeouts falsos en modelos que sí están generando pero tardan en setup
- UX pobre: el usuario ve "Generando sugerencia…" cuando todavía ni se ha conectado
- No hay manera de distinguir "cargando modelo" (Ollama) de "generando"
- OpenCode ignora `requestTimeoutMs` por completo

### Solución

1. **Loading phases más granulares:** cada engine reporta su progreso real (conectando, cargando modelo, generando)
2. **Timeout movido a generación:** el timeout de 12s solo se cuenta desde que el LM empieza a generar
3. **OpenCode usa `requestTimeoutMs`:** actualmente no lo usa
4. **Ollama fase `ollama-loading`:** sin timeout duro (el modelo puede tardar en cargar)

---

## Estructura de loading phases objetivo

```ts
export type SuggestionLoadingPhase =
  | "copilot"                    // Buscando modelo Copilot LM
  | "copilot-generating"         // Generando con Copilot LM (timeout desde aquí)
  | "opencode-start"             // Iniciando conexión con OpenCode
  | "opencode-connecting"        // Health check / obteniendo sesión
  | "opencode-generating"        // Generando con OpenCode (timeout desde aquí)
  | "ollama-start"               // Iniciando conexión con Ollama
  | "ollama-loading"             // Cargando modelo en Ollama (sin timeout duro)
  | "ollama-generating";         // Generando con Ollama (timeout desde aquí)
```

### Textos UX asociados

| Fase | Texto |
| :--- | :--- |
| `copilot` | Buscando modelo… |
| `copilot-generating` | Generando sugerencia… |
| `opencode-start` | Iniciando OpenCode… |
| `opencode-connecting` | Conectando con el servidor… |
| `opencode-generating` | Generando sugerencia… |
| `ollama-start` | Iniciando Ollama… |
| `ollama-loading` | Cargando modelo local… |
| `ollama-generating` | Generando sugerencia… |

---

## Progreso general — TODAS LAS FASES COMPLETADAS 🟢

| Fase | Descripción | Estado |
| :--- | :--- |
| **Fase 1** | Actualizar `core/loading.ts` — nuevos phases + textos | 🟢 |
| **Fase 2** | Actualizar `core/types.ts` — doc `requestTimeoutMs` | 🟢 |
| **Fase 3** | Copilot: mover timeout a `copilot-generating` | 🟢 |
| **Fase 4** | OpenCode: emitir `opencode-start`, timeout con `Promise.race` | 🟢 |
| **Fase 5** | Ollama: añadir `ollama-loading` entre start y generating | 🟢 |
| **Fase 6** | Pipeline: mapeo initialPhase verificado (correcto) | 🟢 |
| **Fase 7** | Webview: compatibilidad con nuevos phases (sin cambios, usa statusText) | 🟢 |
| **Fase 8** | `npm run check` verde | 🟢 |

---

## Detalle de fases

### Fase 1 — `core/loading.ts`

**Cambios:**

```ts
export type SuggestionLoadingPhase =
  | "copilot"
  | "copilot-generating"          // ← NUEVO
  | "opencode-start"              // ← NUEVO
  | "opencode-connecting"
  | "opencode-generating"
  | "ollama-start"
  | "ollama-loading"              // ← NUEVO
  | "ollama-generating";
```

\n\nTextos:\n- `copilot` → "Buscando modelo…"
- `copilot-generating` → "Generando sugerencia…"
- `opencode-start` → "Iniciando OpenCode…"
- `opencode-connecting` → "Conectando con el servidor…"
- `opencode-generating` → "Generando sugerencia…"
- `ollama-start` → "Iniciando Ollama…"
- `ollama-loading` → "Cargando modelo local…"
- `ollama-generating` → "Generando sugerencia…"\n\n### Fase 2 — `core/types.ts`

**Cambios:**

```ts
export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 12000;
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;  // ← NUEVO
```

Documentar en `CompletionRequestOptions.requestTimeoutMs` que aplica solo desde que el LM empieza a generar.

### Fase 3 — Copilot engine

**Antes** (`copilotLmEngine.ts:44-67`):

```ts
const requestTokenSource = new vscode.CancellationTokenSource();
const requestCancellation = token.onCancellationRequested(() => { ... });
const timeoutHandle = setTimeout(() => { requestTokenSource.cancel(); }, requestTimeoutMs);
// ... buildCompletionInstructionParts...
onLoadingPhase?.("copilot");
const response = await model.sendRequest(...);
```

**Después:**

```ts
onLoadingPhase?.("copilot");  // Buscando modelo
const models = await vscode.lm.selectChatModels(...);
const model = selectModelByPolicy(...);
// ...
const { prefixInstruction, labeledPartial } = buildCompletionInstructionParts(...);

onLoadingPhase?.("copilot-generating");  // ← timeout empieza aquí
const requestTokenSource = new vscode.CancellationTokenSource();
const timeoutHandle = setTimeout(() => { requestTokenSource.cancel(); }, requestTimeoutMs);
const response = await model.sendRequest(...);
```

### Fase 4 — OpenCode engine

**Antes** (`opencodeLmEngine.ts:70-90`):

```ts
onLoadingPhase?.("opencode-connecting");
const alive = await ensureClient();
// ...
onLoadingPhase?.("opencode-generating");
const completionText = await promptOpenCode(...);
```

**Después:**

```ts
onLoadingPhase?.("opencode-start");  // ← NUEVO
const alive = await ensureClient();
if (!alive) return { kind: "empty", reason: "no-model" };

const modelName = await resolveOpenCodeModel(preferredModelId);
const instruction = buildCompletionInstruction(userText, style, context);
const client = getGlobalClient();
const sessionId = await getSession(client);

onLoadingPhase?.("opencode-generating");  // ← timeout empieza aquí
const completionText = await promptOpenCode(sessionId, ..., [{ type: "text", text: instruction }], client);
```

Además, implementar un timeout real en `promptOpenCode` o alrededor de la llamada (usar `AbortController` con `requestTimeoutMs`).

### Fase 5 — Ollama engine

**Antes** (`ollamaLmEngine.ts:59-78`):

```ts
onLoadingPhase?.("ollama-start");
const modelName = await resolveOllamaModel(preferredModelId);
// ...
onLoadingPhase?.("ollama-generating");
const completionText = await generate(instruction, modelName, { ... });
```

**Después:**

```ts
onLoadingPhase?.("ollama-start");
const modelName = await resolveOllamaModel(preferredModelId);
if (!modelName) return { kind: "empty", reason: "no-model" };

onLoadingPhase?.("ollama-loading");  // ← NUEVO (sin timeout)
const instruction = buildCompletionInstruction(userText, style, context);

onLoadingPhase?.("ollama-generating");  // ← timeout desde aquí
const completionText = await generate(instruction, modelName, {
    requestTimeoutMs,  // ya se pasa correctamente
    ...
});
```

El `requestTimeoutMs` ya se pasa a `generate()`, no hay que añadirlo. El cambio es solo emitir `ollama-loading` entre `ollama-start` y `ollama-generating`.

### Fase 6 — Pipeline `suggestPipeline.ts`

Actualizar el mapeo de `routedSource` → `initialPhase`:

```ts
const initialPhase: SuggestionLoadingPhase =
    routedSource === "opencode" ? "opencode-start" :
    routedSource === "ollama" ? "ollama-start" : "copilot";
```

Esto ya es correcto con los nuevos nombres. Verificar que `emitLoadingPhase` se llama correctamente.

### Fase 7 — Webview `main.ts`

Verificar que la UI del webview maneje correctamente los nuevos `phase` values. El webview actual solo muestra `statusText`, no el `phase` directamente, así que debería funcionar sin cambios. Pero revisar que no haya ningún `switch` o validación que pueda fallar con fases desconocidas.

### Fase 8 — `npm run check`

---

## Bitácora

| Fecha | Cambio |
|-------|--------|
| 2026-05-13 | Roadmap creado. Plan: auditoría de timeouts y loading phases para v0.5.4. |
| 2026-05-13 | **Fases 1-8 completadas.** Nuevos phases: `copilot-generating`, `opencode-start`, `ollama-loading`. Timeout movido a generación en Copilot y OpenCode. OpenCode ahora usa `requestTimeoutMs` via `Promise.race`. 230 tests passing. `npm run check` verde. |
