# Spike v0.3.0c — API `@opencode-ai/sdk` y upstream OpenCode

**Fecha:** 2026-05-09  
**Pin del proyecto:** `@opencode-ai/sdk@1.14.44` (ver `package.json`).  
**Objetivo roadmap:** inventario de exports, opciones de streaming frente a `session.prompt`, compatibilidad CLI `serve` con el puerto dedicado GhostPrompt (**17433**), y seguimiento del workaround **Undici `duplex`**.

---

## D1 — Inventario SDK (`npm`, inspección local de `dist/`)

### Subpaths exportados (`package.json` → `exports`)

| Export | Rol |
|--------|-----|
| `@opencode-ai/sdk` | `createOpencode()`, reexport de `./client`, `./server` — **entrada usada por GhostPrompt**. |
| `@opencode-ai/sdk/client` | `createOpencodeClient(config?)` → `OpencodeClient` (cliente HTTP contra URL base). |
| `@opencode-ai/sdk/server` | `createOpencodeServer`, `createOpencodeTui`, `ServerOptions`. |
| `@opencode-ai/sdk/v2` | Misma forma que la raíz; `createOpencodeClient` admite `experimental_workspaceID`. |

El cliente generado (`OpencodeClient` en `dist/gen/sdk.gen.d.ts`) expone entre otros: **`config`** (`get`, `update`, **`providers`**), **`session`** (`create`, **`prompt`**, **`promptAsync`**, `abort`, `delete`, `messages`, …), **`global.event`**, **`event.subscribe`** (ambos devuelven tipos basados en **`ServerSentEventsResult`** / streaming SSE).

### Qué usa GhostPrompt hoy

- `import("@opencode-ai/sdk").createOpencode({ hostname, port, timeout })` → servidor embebido + `OpencodeClient`.
- Completions: `session.create` → **`session.prompt`** (respuesta única al finalizar).
- Catálogo: `config.providers()`.
- Salud: `config.get()`.

---

## D2 — Streaming vs request-response

| Enfoque | Comportamiento | Encaje con ghost-text incremental |
|---------|------------------|-----------------------------------|
| **`session.prompt`** | Request/response; el tipo usa `RequestResult` (no SSE en la llamada directa). | **Actual:** coincide con “mostrar sugerencia cuando termina el turno”. Latencia = tiempo hasta respuesta completa. |
| **`session.promptAsync`** | Documentación SDK: arranca envío y **retorna enseguida**; el flujo completo implica **seguimiento** (p. ej. `session.messages` / eventos). | Posible **menor bloqueo** del cliente HTTP en teoría; el trabajo real sigue en servidor. Esfuerzo **M**: máquina de estados + cancelación + límites de tiempo alineados con `CancellationToken`. |
| **`global.event()` / `event.subscribe()`** | SSE (`createSseClient`, callbacks `onSseEvent`). | Si el servidor emite **fragmentos de asistente** por SSE, permitiría ghost-text **progresivo** (gran mejora UX). Requiere validar **forma de eventos** y estabilidad del contrato → esfuerzo **L**, depende de documentación/API estable. |

**Decisión provisional:** Mantener **`session.prompt`** como fuente de verdad para el texto final; los SSE **`message.part.delta`** ya demuestran streaming incremental — el siguiente paso de producto es **filtrar por parte** (respuesta vs `reasoning`) y decidir si el ghost-text en vivo muestra solo la parte final o también el razonamiento.

### Spike en runtime (implementado en código)

Con **`ghostPrompt.debugSuggestions`: true** y proveedor OpenCode (o ruta enrutada a OpenCode), en cada **`session.prompt`** GhostPrompt abre en paralelo dos SSE del cliente SDK:

- **`GET /global/event`** → logs con prefijo `[opencode] [sse-/global/event]`
- **`GET /event`** → `[opencode] [sse-/event]`

Los payloads se serializan con límite (~1200 caracteres) en `summarizeSsePayloadForDebug` (`src/opencode/opencodeSsePayloadSummary.ts`). Tras **80** eventos por canal se suprime el resto del volcado para no inundar el canal.

**Cómo usarlo:** comando **GhostPrompt: Toggle Debug**, panel de salida **GhostPrompt Suggestions**, activar OpenCode y disparar una sugerencia inline. Al terminar el prompt, las conexiones SSE se abortan.

**Qué buscar:** campos que indiquen texto del asistente parcial o `parts` incrementales; si solo aparecen eventos de estado genéricos, el ghost-text progresivo seguiría requiriendo otro canal (p. ej. `promptAsync` + polling).

**Archivos:** `src/opencode/opencodeSseDebug.ts`, cableado en `requestOpencodeCompletion` (`src/completion/providers/opencodeLmCompletion.ts`).

### Hallazgos (log capturado en VS Code, OpenCode `big-pickle`)

Confirmado en captura local de depuración (2026-05-09):

1. **Los deltas son utilizables para streaming:** aparece `payload.type` / `type` = **`message.part.delta`** con `properties.field` = `"text"` y **`delta`** en trozos pequeños (`"The"`, `" user"`, …). Es el formato idóneo para ir ensamblando texto en la UI.

2. **Atención al tipo de parte:** antes de los deltas hay `message.part.updated` con `part.type` = **`reasoning`** y un `partID` fijo. Los primeros deltas van a ese **razonamiento interno** (metatexto en inglés sobre la tarea), **no** a la respuesta breve en español que GhostPrompt muestra al usuario vía `session.prompt`. Para ghost-text encima del input hay que **filtrar por parte**: usar solo deltas cuya parte sea la respuesta final (`type: text` del asistente), u omitir `reasoning` según política de producto.

3. **`/event` vs `/global/event`:** el mismo evento llega por ambos canales; el global añade `directory` / `project`. Para una futura implementación basta **una** suscripción para no duplicar trabajo.

4. **Límite de 80 eventos por canal:** en modelos con partes de razonamiento largas se alcanza el truncado rápido; una implementación real necesitaría otro límite o **solo** registrar/fusionar deltas de la parte elegida.

---

## D3 — CLI `serve` y puerto **17433**

Documentación pública ([CLI / Server](https://opencode.ai/docs/cli)): `opencode serve` expone la API HTTP; puerto por defecto habitual **4096** (configurable).

GhostPrompt usa **`127.0.0.1:17433`** en código (`GHOST_PROMPT_OPENCODE_PORT`) para **no chocar** con una instancia OpenCode del usuario en el puerto por defecto.

Compatibilidad si el usuario quiere **servidor externo** en el mismo puerto que GhostPrompt:

```bash
opencode serve --hostname 127.0.0.1 --port 17433
```

**Riesgo conocido upstream:** orden de carga de config vs bind del servidor ([issue citada en búsqueda](https://github.com/anomalyco/opencode/issues/17927)) — si `server.port` en archivo no aplica, usar **`--port` en CLI**.

GhostPrompt **no** usa hoy `createOpencodeClient({ baseUrl })` contra un `serve` manual; el modelo de producto es **servidor embebido** vía `createOpencode`.

---

## D4 — Undici y `duplex: "half"`

El cliente Hey-API puede enviar **body como `ReadableStream`** sin `duplex`, lo que en Node dispara: *"duplex option is required when sending a body"*.

GhostPrompt aplica **`ensureNodeFetchDuplex()`** (`src/opencode/nodeFetchDuplex.ts`): parche de `Request` + envoltorio de `fetch`.

**Seguimiento:** revisar notas de versión de `@opencode-ai/sdk` y del generador OpenAPI cuando se actualice el pin; solo retirar el parche tras **prueba en Node del mismo runtime que VS Code** con reproducción negativa.

---

## D5 — Tabla decisión / riesgo / seguimiento

| Mejora | Esfuerzo | Bloquea UX actual | Riesgo | Siguiente paso |
|--------|----------|-------------------|--------|----------------|
| Ghost-text **SSE** desde `event` / eventos globales | **L** | No | Contrato de eventos puede cambiar | [x] Log en debug (`opencodeSseDebug.ts`); interpretar muestras en salida **Suggestions** |
| **`promptAsync` + polling** de mensajes | **M** | No | Complejidad de cancelación y condiciones de carrera | Prototipo tras definir API estable de “mensaje final” |
| Seguir en **`session.prompt`** | — | — | Ninguno extra | Baseline mantenimiento |
| Quitar **`nodeFetchDuplex`** tras fix upstream/SDK | **S** | No | Regresión en extension host | Test manual + CI en bump de SDK |
| Documentar **`opencode serve --port 17433`** para usuarios avanzados | **S** | No | Confusión con embebido | Opcional: párrafo en README *Advanced* |

---

## Referencias

- SDK npm: [OpenCode SDK docs](https://opencode.ai/docs/sdk), paquete `@opencode-ai/sdk`.
- Integración GhostPrompt previa: [`Roadmap-v0.3-opencode-integration.md`](../Roadmaps/Roadmap-v0.3-opencode-integration.md).
