# Roadmap v0.5.2 — Reestructuración general + OpenCode como API client

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Contexto y decisiones de diseño

### El problema actual

`src/opencode/` (14 archivos) levanta un proceso `opencode serve` embebido y gestiona su lifecycle. `vsOpenCodeXConnection.ts` usa la extensión VSOpenCodeX para obtener una conexión SDK ya autenticada. Ambas responsabilidades están entrelazadas y son innecesariamente complejas: **GhostPrompt no debería levantar ni gestionar servidores OpenCode**.

### La dirección

**OpenCode como motor tipo Ollama**: GhostPrompt se conecta a una instancia OpenCode ya corriendo via HTTP SDK (`createOpencodeClient`), hace health check via `config.get()`, usa session pool para latencia, y no depende de VSOpenCodeX para nada. VSOpenCodeX es un **destino** (reenvío UI), no un puente de conexión.

### Decisiones confirmadas

| # | Decisión |
|---|----------|
| 1 | **Puerto por defecto OpenCode: 4096** — configurable via `ghostPrompt.opencodePort` |
| 2 | **Auth**: token existente via `ghostPrompt.opencodeAuthToken` (ya existe del diseño previo) |
| 3 | **Session pool** se mantiene — para no pagar `create`+`delete` por cada request |
| 4 | **VSOpenCodeX es destino** — reenvío UI, se queda en `destinations/vsOpenCodeX/` |
| 5 | **Puente `vsOpenCodeXConnection.ts` se ELIMINA** — ya no proporciona conexión a OpenCode |
| 6 | **`src/opencode/` se ELIMINA completo** — runtime, CLI detection, lifecycle, warm-up, todos esos archivos |
| 7 | **`ghostPrompt.vsOpenCodeX*` settings de conexión** se eliminan — solo quedan los de notificación (destino) |
| 8 | Catálogos de OpenCode van a `engines/opencode/catalog/` |

---

## Progreso general

| Fase | Descripción | Estado | PR | Notas |
|------|-------------|--------|----|-------|
| **Fase A** | `opencodeApiClient.ts` — health check, session CRUD, prompt, SSE | ⚪ | — | |
| **Fase B** | `opencodeLmEngine.ts` — usa apiClient, estilo ollamaLmEngine | ⚪ | — | |
| **Fase C** | Migrar catálogos OpenCode a `engines/opencode/catalog/` | ⚪ | — | |
| **Fase D** | Eliminar `vsOpenCodeXConnection.ts` de `engines/opencode/` | ⚪ | — | |
| **Fase E** | Eliminar `src/opencode/` completo (runtime) | ⚪ | — | |
| **Fase F** | Ajustar settings: eliminar `vsOpenCodeX*` connection, mantener notification | ⚪ | — | |
| **Fase G** | Actualizar `vsOpenCodeXDestination` — eliminar lógica de conexión | ⚪ | — | |
| **Fase H** | Actualizar `engineRegistry` + consumers | ⚪ | — | |
| **Fase I** | Tests: crear, actualizar, eliminar según cambios | ⚪ | — | |
| **Fase J** | Documentación: ARCHITECTURE, Owners, CHANGELOG | ⚪ | — | |

---

## Fase A — `opencodeApiClient.ts`

### Responsabilidades
- Health check: `GET /config` via `client.config.get()` — ligero, sin auth
- Session pool: `create` → `prompt` → guardar `sessionId` → reutilizar → `delete` al cerrar
- Prompt: `POST /session/{id}/prompt` via `client.session.prompt()`
- SSE streaming: `GET /event` via `client.event.subscribe()`
- Configurable: `baseUrl` (default `http://127.0.0.1:4096`), `authToken`

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| A.1 | Definir `OpenCodeClientOptions`: `baseUrl`, `authToken`, `port` (default 4096) | ⚪ |
| A.2 | `createOpenCodeClient(options)` — crea `createOpencodeClient` con auth header si hay token | ⚪ |
| A.3 | `healthCheck(client)` — `client.config.get()`, lanza si falla | ⚪ |
| A.4 | `createSession(client)` — `client.session.create()`, devuelve `sessionId` | ⚪ |
| A.5 | `prompt(client, sessionId, model, parts)` — `client.session.prompt()`, parsea envelope | ⚪ |
| A.6 | `deleteSession(client, sessionId)` — `client.session.delete()` | ⚪ |
| A.7 | `promptStream(client, sessionId, signal)` — `client.event.subscribe()`, yield deltas | ⚪ |
| A.8 | Session pool interno: Map<sessionId, {client, lastUsed}> con TTL y max-size | ⚪ |
| A.9 | `getSession(client)` — obtiene o crea sesión del pool | ⚪ |
| A.10 | `closePool()` — delete todas las sesiones del pool | ⚪ |

**Criterio de salida:** `opencodeApiClient.ts` funcional con tests unitarios (health check, session create/prompt/delete, pool evict).

---

## Fase B — `opencodeLmEngine.ts`

### Responsabilidades
- Implementa `requestOpencodeCompletion()` — interfaz `CompletionProvider`
- Obtiene sesión del apiClient pool
- Construye prompt con `instruction.ts` + normalize
- Soporte streaming (preview via SSE)
- Maneja errores: quota, timeout, abort

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| B.1 | Crear `engines/opencode/opencodeLmEngine.ts` — esqueleto con签interface `CompletionProvider` | ⚪ |
| B.2 | Integrar `opencodeApiClient` — `getSession()` → `prompt()` → `deleteSession()` (o no si pool guarda) | ⚪ |
| B.3 | Loading phases: `opencode-start`, `opencode-generating` | ⚪ |
| B.4 | Streaming: hook `onPreview` llama a `promptStream` del apiClient | ⚪ |
| B.5 | Normalización de respuesta: parsear `payload.data.parts`, extraer texto, normalizar con `normalize.ts` | ⚪ |
| B.6 | Manejo de errores: timeout, abort, quota | ⚪ |
| B.7 | Settings: `ghostPrompt.opencodePort`, `ghostPrompt.opencodeAuthToken`, `ghostPrompt.opencodeExcludedModelIds` | ⚪ |

**Criterio de salida:** `opencodeLmEngine.ts` produce `CompletionResult` identical pattern a `ollamaLmEngine.ts`. Tests: 10+.

---

## Fase C — Migrar catálogos OpenCode a `engines/opencode/catalog/`

### Archivos a mover

```
completion/catalog/
  ├── opencodeModelCatalog.ts              → engines/opencode/catalog/
  ├── normalizeOpencodeProviderModels.ts   → engines/opencode/catalog/
  └── opencodeModelTier.ts                → engines/opencode/catalog/
```

**Nota:** `opencodeModelCatalog.ts` actualmente usa `OpenCodeRuntime` y `opencodeProvidersSnapshot`. Tras eliminar el runtime, usará `opencodeApiClient.config.providers()` para listar modelos del servidor.

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| C.1 | Crear `engines/opencode/catalog/` | ⚪ |
| C.2 | Mover `opencodeModelCatalog.ts` — actualizar imports: `opencodeApiClient` en vez de `OpenCodeRuntime` | ⚪ |
| C.3 | Mover `normalizeOpencodeProviderModels.ts` — sin cambios | ⚪ |
| C.4 | Mover `opencodeModelTier.ts` — sin cambios | ⚪ |
| C.5 | Actualizar imports en `completion/catalog/mergedModelCatalog.ts` | ⚪ |
| C.6 | Actualizar exports en `engines/opencode/index.ts` | ⚪ |
| C.7 | Eliminar originals de `completion/catalog/` | ⚪ |
| C.8 | Tests actualizados | ⚪ |

**Criterio de salida:** Compilación verde, 230+ tests, catálogos de OpenCode en su carpeta correcta.

---

## Fase D — Eliminar `vsOpenCodeXConnection.ts`

### Contexto
`vsOpenCodeXConnection.ts` actualmente en `engines/opencode/` obtiene conexión SDK de VSOpenCodeX y crea el client. Ya no se necesita — el apiClient se crea directamente sin depender de VSOpenCodeX.

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| D.1 | Identificar todos los consumers de `vsOpenCodeXConnection` | ⚪ |
| D.2 | Eliminar `vsOpenCodeXConnection.ts` de `engines/opencode/` | ⚪ |
| D.3 | Eliminar exports de `vsOpenCodeXConnection` desde `engines/opencode/index.ts` | ⚪ |
| D.4 | Verificar que nada más importa este módulo | ⚪ |

**Criterio de salida:** `vsOpenCodeXConnection.ts` no existe en `engines/opencode/`.

---

## Fase E — Eliminar `src/opencode/` completo

### Archivos a eliminar

```
src/opencode/
  ├── index.ts
  ├── constants.ts              (puerto 17433 dedicado — ya no aplica)
  ├── OpenCodeRuntime.ts         (spawn embebido — desaparece)
  ├── openCodeCli.ts             (CLI detection — desaparece)
  ├── openCodeServerLifecycleHooks.ts
  ├── opencodeProvidersSnapshot.ts
  ├── opencodeInlineSuggestionSession.ts   (session pool del runtime — desaparece)
  ├── opencodeInlineCompletionQueue.ts     (cola serie del runtime — desaparece)
  ├── opencodeSuggestionStream.ts          (SSE del proceso — desaparece)
  ├── opencodeSuggestionStreamFold.ts
  ├── opencodeSsePayloadSummary.ts
  ├── opencodeSseDebug.ts
  ├── sdkEnvelope.ts            (tipos del protocolo SDK — ¿mover a shared/?)
  ├── warmOpenCodeRuntime.ts
  ├── syncOpenCodeRuntimeFromConfig.ts
  └── nodeFetchDuplex.ts
```

**Excepción:** `sdkEnvelope.ts` tiene helpers de parsing (`parseOpencodePromptResultPayload`, `unpackOpencodeSessionCreateId`, `concatOpencodeAssistantTextParts`) que pueden ser útiles para el apiClient. **Se mueven a `engines/opencode/opencodeApiClient.ts`** o a `shared/`.

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| E.1 | Identificar helpers útiles de `sdkEnvelope.ts` → mover a apiClient | ⚪ |
| E.2 | Matar todos los imports a `src/opencode/` en `src/` | ⚪ |
| E.3 | Eliminar carpeta `src/opencode/` | ⚪ |
| E.4 | Verificar `npm run compile` verde | ⚪ |

**Criterio de salida:** `src/opencode/` no existe. Compilación verde.

---

## Fase F — Ajustar settings

### Settings a eliminar

```
ghostPrompt.vsOpenCodeXProbeDelayMs
ghostPrompt.vsOpenCodeXConnectionMaxAttempts
ghostPrompt.vsOpenCodeXConnectionRetryGapMs
ghostPrompt.preferVsOpenCodeXOpenCode
```

### Settings a crear/renombrar

```
ghostPrompt.opencodePort          (default: 4096)
ghostPrompt.opencodeAuthToken     (default: empty — sin auth)
ghostPrompt.opencodeEnabled      (¿o se usa enabledCompletionSources?)
```

### Settings que permanecen

```
ghostPrompt.vsOpenCodeXAgentDestination  (destino — no cambia)
ghostPrompt.agentDestination               (no cambia)
```

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| F.1 | Eliminar settings de VSOpenCodeX connection de `package.json` | ⚪ |
| F.2 | Crear/renombrar `opencodePort`, `opencodeAuthToken` en `package.json` | ⚪ |
| F.3 | Actualizar `ghostPromptHostWorkspaceGetters.ts` | ⚪ |
| F.4 | Verificar webview settings message payload | ⚪ |

**Criterio de salida:** Settings limpios. Compilación verde.

---

## Fase G — Actualizar `vsOpenCodeXDestination`

### Contexto
`vsOpenCodeXDestination.ts` actualmente incluye `VS_OPEN_CODE_X_EXTENSION_ID` y la función `notifyIfVsxAgentDestinationWithoutVsOpenCodeX`. No tiene lógica de conexión a OpenCode — eso estaba en `vsOpenCodeXConnection.ts`. Pero hay que verificar que no quedó ningún import de algo que se eliminó.

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| G.1 | Verificar que `vsOpenCodeXDestination.ts` no importa nada de `src/opencode/` | ⚪ |
| G.2 | Verificar que no importa `vsOpenCodeXConnection.ts` | ⚪ |
| G.3 | Asegurar que `getGhostPromptAgentDestination` viene de `destinationRegistry` (ya está así) | ⚪ |

**Criterio de salida:** Sin cambios de código necesarios si no hay imports rotos.

---

## Fase H — Actualizar `engineRegistry` y consumers

### Consumers del runtime de `src/opencode/`

| Archivo | ¿Qué usa? | Acción |
|---------|-----------|--------|
| `extension.ts` | `getOpenCodeRuntime`, `syncOpenCodeRuntimeFromConfig`, `warmOpenCodeRuntime` | Eliminar imports — no más runtime |
| `MiniInputViewProvider.ts` | `warmOpenCodeRuntime` | Eliminar — no más warm-up |
| `ghostPromptHostWorkspaceGetters.ts` | `isVsOpenCodeXExtensionInstalled` (re-exportado) | OK — se queda |
| `ghostPromptSettingsPostMessage.ts` | ¿? | Revisar |

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| H.1 | Actualizar `engines/engineRegistry.ts` — usar nuevo `opencodeLmEngine` | ⚪ |
| H.2 | Actualizar `extension.ts` — eliminar imports de `src/opencode/` | ⚪ |
| H.3 | Actualizar `MiniInputViewProvider.ts` — eliminar warmOpenCodeRuntime | ⚪ |
| H.4 | Revisar `ghostPromptSettingsPostMessage.ts` | ⚪ |
| H.5 | Verificar `engines/opencode/index.ts` — barrel actualizado | ⚪ |
| H.6 | `npm run compile` verde | ⚪ |

**Criterio de salida:** Compilación verde, todos los consumers usan la nueva estructura.

---

## Fase I — Tests

### Tests a eliminar

| Test | Motivo |
|------|--------|
| `openCodeRuntimeVsxNoEmbedded.test.ts` | Depende del runtime embebido |
| `opencodeProvidersSnapshot.test.ts` | Runtime eliminado |
| `opencodeProvidersSnapshot.perf.test.ts` | Runtime eliminado |
| `opencodeSuggestionStream.test.ts` | SSE del proceso eliminado |
| `vsOpenCodeXBridge.test.ts` | Puente eliminado |
| `opencodeLmCompletion.test.ts` | Depende del runtime |

### Tests a crear/actualizar

| Test | Cobertura |
|------|-----------|
| `opencodeApiClient.test.ts` | Health check, session CRUD, pool, stream |
| `opencodeLmEngine.test.ts` | requestCompletion, loading phases, errors |
| `opencodeModelCatalog.test.ts` | (actualizar imports tras migración) |

### Tests a verificar que siguen pasando

- `destinationRegistry.test.ts` ✅
- `copilotChatDestination.test.ts` ✅
- `vsOpenCodeXDestination.test.ts` (revisar tras cambios)
- `engineRegistry.test.ts` (actualizar tras nuevo opencodeLmEngine)

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| I.1 | Eliminar tests del runtime | ⚪ |
| I.2 | Crear `opencodeApiClient.test.ts` | ⚪ |
| I.3 | Crear `opencodeLmEngine.test.ts` | ⚪ |
| I.4 | Actualizar `opencodeModelCatalog.test.ts` tras migración | ⚪ |
| I.5 | `npm run test` verde — 230+ tests | ⚪ |

**Criterio de salida:** `npm run check` verde (0 círculos, 0 errores).

---

## Fase J — Documentación

### Subpasos

| # | Subpaso | Estado |
|---|---------|--------|
| J.1 | `Docs/ARCHITECTURE.md` — actualizar module map, quitar OpenCodeRuntime, actualizar pipeline | ⚪ |
| J.2 | `Docs/Owners.md` — matriz `engines/opencode/` actualizada, `src/opencode/` eliminado, bitácora | ⚪ |
| J.3 | `Docs/Plans/Roadmaps/Roadmap-v0.5.2-general-restructuring.md` — este documento marcar como completado | ⚪ |
| J.4 | `CHANGELOG.md` — entrada v0.5.2 | ⚪ |
| J.5 | `npm run validate` verde | ⚪ |

---

## Referencias

- Roadmap destinations (completado): [`Roadmap-v0.5.1-destinations-refactor.md`](./Roadmap-v0.5.1-destinations-refactor.md)
- Roadmap Ollama (completado): [`Roadmap-v0.5.1-ollama-integration.md`](./Roadmap-v0.5.1-ollama-integration.md)
- Matriz motor-destino: [`Docs/Integrations/GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md)
- Spike SDK OpenCode: [`Docs/Plans/Spikes/Spike-v0.3.0c-opencode-sdk-upstream.md`](../../Plans/Spikes/Spike-v0.3.0c-opencode-sdk-upstream.md)