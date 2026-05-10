# Roadmap v0.3.0c — OpenCode UX, rendimiento y multi‑proveedor

> **Versión de línea:** permanecemos en **GhostPrompt 0.3.0** (sin bump a 0.4.0 para este plan). El sufijo **0c** solo etiqueta esta oleada de trabajo dentro del mismo release.
>
> **Depende de:** integración OpenCode cerrada en [`Roadmap-v0.3-opencode-integration.md`](./Roadmap-v0.3-opencode-integration.md) *(Phases 1–4 completas).*  
> **Arquitectura base:** [`Roadmap-v0.3.0-architecture.md`](./Roadmap-v0.3.0-architecture.md).

## Objetivo

1. **UX:** El usuario debe **entender en qué fase** está el sistema (arranque OpenCode vs llamada al modelo vs Copilot), evitando que “Buscando sugerencia…” absorba todo el tiempo percibido del primer uso.
2. **Rendimiento:** Reducir o **ocultar latencia fría** (cold start del servidor embebido, primera sesión SDK) con warm‑up opcional, políticas de proceso y mediciones.
3. **Producto:** Evolucionar de **un solo motor** (`copilot` XOR `opencode`) hacia **visibilidad de ambos** — p. ej. fuentes habilitables por settings (checks) y/o lista unificada de modelos con proveedor explícito.
4. **Investigación:** Revisar **SDK npm** (`@opencode-ai/sdk`, rutas `v2`), cliente generado y **código abierto** del CLI/servidor OpenCode para streaming, menos round‑trips y alineación con Node/undici.

---

## Contexto en el código actual (punto de partida)

| Área | Comportamiento hoy |
|------|---------------------|
| Estado de carga webview | Un único mensaje al recibir `loading`: **«Buscando sugerencia…»** (`webview/main.js`). |
| Host → webview | Mensaje `{ type: "loading", captureId }` sin sub‑fase ni texto parametrizado (`MiniInputViewProvider`). |
| Proveedor | Setting **`ghostPrompt.completionProvider`**: enum **`copilot`** \| **`opencode`** — catálogo Copilot **o** OpenCode, no fusionado (`MiniInputViewProvider._postSettings`). |
| Runtime OpenCode | `OpenCodeRuntime.start()` antes del primer completion; primera vez suele incluir spawn + health + primer prompt. |

---

## Principios de diseño (v0.3.0c)

1. **Compatibilidad:** Migraciones de settings deben **preservar** `completionProvider` existente hasta que la UI nueva esté lista (valor por defecto coherente).
2. **CI estable:** Tests de integración live OpenCode siguen **opt‑in** (`GHOST_PROMPT_OPENCODE_INTEGRATION=1`); el resto sin red.
3. **Transparencia:** Mensajes cortos, localizables y distinguibles (no tres párrafos en la barra de estado).
4. **Sin obligar doble cuota:** Multi‑proveedor debe dejar claro **qué motor** ejecuta cada suggestion (badge / fila en selector).

---

## Fase A — Estados de UX explícitos (entrega prioritaria)

**Meta:** El webview y/o badge muestran **fase actual**, no solo “buscando”.

**Estado:** **Cerrada** en código (2026-05-09). Mensajes en `suggestionLoadingUi.ts`; webview usa `statusText`; OpenCode emite `opencode-start` → `opencode-connecting` → `opencode-generating`. *No* se postea carga desde `syncOpenCodeRuntimeFromConfig` (no hay request de suggestion activo al cambiar settings).

| ID | Tarea | Notas |
|----|-------|--------|
| **A1** | Extender contrato host → webview | [x] `loading` incluye `phase` + `statusText` (`MiniInputViewProvider` → webview). |
| **A2** | Textos por fase | [x] `suggestionLoadingStatusText()` — Copilot: «Buscando…»; OpenCode: inicio / conexión / generación. |
| **A3** | Cableado en host | [x] Host emite fase inicial + callback `onLoadingPhase`; OpenCode en `opencodeLmCompletion` (antes/después de `start`, antes de `prompt`). |
| **A4** | Accesibilidad | [x] `#status-text` con `aria-live="polite"`; clase `.loading` sin cambios. |
| **A5** | Tests | [x] `tests/suggestionLoadingUi.test.ts` + expectativas `MiniInputViewProvider` actualizadas (mock `completion` con `importOriginal`). |

**Criterio de salida:** Primera suggestion con OpenCode: el usuario ve **al menos una** transición de texto distinta de la generación pura del LLM.

---

## Fase B — Rendimiento y ciclo de vida OpenCode

**Meta:** Menos sorpresa en cold start; proceso vivo cuando tiene sentido.

**Estado:** **Cerrada** en código (2026-05-09). Debug opcional en canal `GhostPrompt Suggestions` (`logOpenCodeDebug`); warm‑up en `warmOpenCodeRuntime.ts`; `scheduleStop` / `cancelScheduledStop` en `OpenCodeRuntime`; README actualizado.

| ID | Tarea | Notas |
|----|-------|--------|
| **B1** | Medición | [x] Con `ghostPrompt.debugSuggestions`: `cold-start-*`, `first-config-get`, `first-session-prompt` (`SuggestionDebug.logOpenCodeDebug`). |
| **B2** | Warm‑up opcional | [x] `warmOpenCodeRuntimeIfConfigured()` al resolver la vista webview; throttle `OPENCODE_WARM_THROTTLE_MS` (20s). |
| **B3** | Política de apagado | [x] Al pasar a Copilot: `scheduleStop` **45s** (`OPENCODE_STOP_DEBOUNCE_MS`); `start()` cancela el timer; `deactivate` sigue cerrando al momento. |
| **B4** | Documentación | [x] README bajo *Optional: OpenCode backend* (cold start, warm-up, debounce, debug). |

**Criterio de salida:** Documento corto en bitácora con números orientativos en 1 máquina + comportamiento definido para `stop`/`idle`.

---

## Fase C — Multi‑proveedor en UI y settings

**Meta:** No forzar XOR eterno; habilitar **ambos mundos** de forma controlada.

**Estado:** **Cerrada** en código (2026-05-09). Setting `ghostPrompt.enabledCompletionSources`; migración por `inspect()`; catálogo fusionado + columnas `completionSource`; enrutado `getCompletionProviderForSource(resolveCompletionSourceForRequest(...))`; badge webview **Motor: Copilot + OpenCode**.

| ID | Tarea | Notas |
|----|-------|--------|
| **C1** | Modelo de producto | [x] Lista única con prefijos **Copilot ·** / **OpenCode ·** en optgroups (`webview/main.js`). Sin fallback automático entre motores si uno falla *(fase posterior).* |
| **C2** | Settings | [x] `ghostPrompt.enabledCompletionSources`: `["copilot","opencode"]`. Legacy `completionProvider` si la clave nunca se guardó. |
| **C3** | Migración | [x] `getEnabledCompletionSources()` usa `inspect`; si no explícito → `completionProvider`. |
| **C4** | Host | [x] `listMergedSuggestionModels` + dedupe por `id`; `SuggestionModelDescriptor.completionSource`. |
| **C5** | Request path | [x] `resolveCompletionSourceForRequest` + `getCompletionProviderForSource`; auto multi → Copilot primero. |

**Criterio de salida:** Usuario puede ver **modelos de ambos orígenes** en el mismo selector (o dos grupos claros) sin cambiar un enum global exclusivo — salvo decisión explícita de mantener XOR en una sub‑opción «legacy».

---

## Fase D — Revisión API SDK y upstream OpenCode

**Meta:** Aprovechar mejor **streaming**, superficies `v2`, y reducir parches locales si upstream corrige.

**Estado:** **Cerrada** en documentación (2026-05-09). Informe: [`Spike-v0.3.0c-opencode-sdk-upstream.md`](../Spikes/Spike-v0.3.0c-opencode-sdk-upstream.md).

| ID | Tarea | Notas |
|----|-------|--------|
| **D1** | Inventario SDK | [x] Exports `/`, `/client`, `/server`, `/v2` (`@opencode-ai/sdk@1.14.44`); cliente `OpencodeClient` con `session`, `config`, `global.event`, `event.subscribe`. |
| **D2** | Streaming | [x] Hoy `session.prompt` (R/R); alternativas `promptAsync`+polling (**M**), SSE `event` (**L** si hay deltas estables). |
| **D3** | CLI `serve` | [x] Default upstream ~4096; GhostPrompt **17433**; `opencode serve --hostname 127.0.0.1 --port 17433`; nota issue config vs `--port`. |
| **D4** | Undici / `duplex` | [x] Mantener `nodeFetchDuplex` hasta bump SDK/generador verificado en Node extension host. |
| **D5** | Salida | [x] Spike + tabla decisión/riesgo/seguimiento en archivo enlazado. |

**Criterio de salida:** Lista priorizada de 2–5 mejoras técnicas con esfuerzo (S/M/L) y si bloquean UX.

---

## Fuera de alcance (v0.3.0c explícito)

- Paridad **tiers** included/premium para modelos OpenCode (sigue siendo roadmap posterior).
- Localización i18n completa de todos los strings (solo inglés/español inline si se toca UX).
- Cambio de versión de marketplace **0.4.0** — este documento asume **misma línea 0.3.0** hasta decisión de release global.

---

## Definición de hecho (v0.3.0c)

- [x] Fase **A** entregada: fases de carga visibles en UI para OpenCode + tests actualizados.
- [x] Fase **B**: medición (debug) + warm‑up webview + debounce de apagado + README.
- [x] Fase **C**: `enabledCompletionSources`, catálogo fusionado, router por modelo, README/settings JSON.
- [x] Fase **D**: informe breve API/upstream enlazado desde este archivo.
- [ ] `npm run check` verde; integración live sigue opt‑in.

---

## Bitácora

| Fecha | Nota |
|-------|------|
| 2026-05-09 | **Fase A:** contrato `loading` + `suggestionLoadingUi.ts`; `onLoadingPhase` en `CompletionRequestOptions`; Panel HTML `aria-live`; roadmap marcado. |
| 2026-05-09 | **Fase B:** `logOpenCodeDebug`; warm-up al abrir vista (`OPENCODE_WARM_THROTTLE_MS`); `scheduleStop(45s)` al elegir Copilot; bitácora números = medir en local con debug on (no CI). |
| 2026-05-09 | **Fase C:** multi-fuente `enabledCompletionSources`, merge catálogo, `completionSource`, router; sync OpenCode si fuente incluye opencode. |
| 2026-05-09 | **Fase D:** spike SDK/upstream [`Spike-v0.3.0c-opencode-sdk-upstream.md`](../Spikes/Spike-v0.3.0c-opencode-sdk-upstream.md) — inventario exports, streaming vs `prompt`, CLI `serve`/17433, seguimiento `duplex`. |
| 2026-05-09 | Continuación planeada: [`Roadmap-v0.3.0d-opencode-streaming-catalog.md`](./Roadmap-v0.3.0d-opencode-streaming-catalog.md) (streaming SSE, selector **Gratis**, auditoría catálogo). |

---

## Referencias

- Siguiente oleada (misma línea 0.3.0): [`Roadmap-v0.3.0d-opencode-streaming-catalog.md`](./Roadmap-v0.3.0d-opencode-streaming-catalog.md).
- SDK: [OpenCode SDK](https://opencode.ai/docs/sdk), paquete npm `@opencode-ai/sdk`.
- Spike Fase D: [`Spike-v0.3.0c-opencode-sdk-upstream.md`](../Spikes/Spike-v0.3.0c-opencode-sdk-upstream.md).
- README usuario: [Developing and tests](../../../README.md#developing-and-tests) (`npm run test:integration`).
- Integración previa: [`Roadmap-v0.3-opencode-integration.md`](./Roadmap-v0.3-opencode-integration.md).
