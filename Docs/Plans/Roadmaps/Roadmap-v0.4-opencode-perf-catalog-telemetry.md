# Roadmap v0.4 (extensión) — OpenCode: catálogo en caché, latencia de sesión y telemetría (debug)

> **Versión objetivo marketplace:** **0.4.1** (CHANGELOG + README listos; código y VSIX pueden probarse en local antes de publicar). **0.4.0** ya publicada lleva sobre todo memoria proyecto + OpenCode **G–H**; **I** y notas **J** se empaquetan como **0.4.1** (“memoria de proyecto” sigue descrita en [`Roadmap-v0.4-project-context-store.md`](./Roadmap-v0.4-project-context-store.md)).
>
> **Problema:** las suggestions vía OpenCode tardan sistemáticamente más que Copilot por coste **por petición**: `config.providers()` en cada `suggest`, `session.create` + `session.delete` en cada ronda, y el `finally` actual **bloquea** la resolución de `requestOpencodeCompletion` hasta cerrar SSE y ejecutar `delete`. Además, las fases de carga perceived UX son difíciles de diagnosticar sin medición.

---

## Objetivos

1. **Catálogo único**: llamar al snapshot de **`config.providers()`** (payload normalizado reusable) como mucho una vez tras servidor OpenCode listo por ciclo de vida útil definido — **no** en cada keystroke suggestion.
2. **Menos trabajo HTTP por suggestion**: evaluar **reutilización de sesión** (`session`) y/o **cleanup no bloqueante** para eliminar tiempo muerto después de la respuesta del modelo.
3. **Observabilidad sólo con debug**: marcas de tiempo (ms o delta) entre fases, visibles sólo cuando **`ghostPrompt.debugSuggestions`** (u homónimo canal OpenCode ya existente) está activo; sin telemetry remota ni PII nueva.

---

## Decisiones cerradas (design record)

| Tema | Decisión |
| ------ | ---------- |
| Caché de catálogo | **Un módulo / singleton** (“Opencodeproviders snapshot”) poblar por **warm después de `runtime.start()` ok** + **primer acceso concurrente con single-flight** (`Promise` compartido). Consumen `opencodeLmCompletion.ts` y el path del webview que lista modelos (`opencodeModelCatalog.ts` / `mergedModelCatalog.ts` según convenga) **la misma API** para no divergir listas. |
| Invalidación | **Re-fetch** ante: resultado vacío/indeterminado de resolución de modelo tras prompt fallido; comando/recarga opcional documentado en README spike; **`onDidChangeConfiguration`** si algún día OpenCode expone señal; como mínimo **tras `deactivate`/re‑`activate`** se limpia caché. |
| TTL catálogo (opc.) | TTL blando (p. ej. 5–15 min) **opcional**: si está activo y expira solo en idle, siguiente suggest dispara refresh en background antes de resolver modelo; documentar si se introduce. |
| `session.delete` | **No hacer `await` en el critical path que devuelve la suggestion al gobernador**; `delete` **best‑effort** en segundo plano (o cola serial ligera) con `catch` silencioso con log debug. |
| Reuse de sesión | **Fase 2:** mantener **una sesión “inline”** reutilizable por runtime (o por workspace) mientras el SDK permita múltiples `prompt` en la misma sesión sin estado corrupto; si OpenCode exige sesión por turno, documentar y limitarse a delete no bloqueante + caché de providers. |
| Telemetría | **Sólo logs** al canal existente (`SuggestionDebug` / `logOpenCodeDebug`) condicionados a **debug on**; líneas con prefijo estable p. ej. `[opencode-perf]` y `captureId` cuando aplique desde el caller. |

---

## Baseline en código (sitios exactos)

- `src/completion/providers/opencodeLmCompletion.ts` — `resolveOpencodeModelIds` → `await client.config.providers()`; `session.create` / `prompt` / `finally` + `session.delete`; `consumeOpencodeSuggestionTextStream`.
- `src/completion/catalog/opencodeModelCatalog.ts` (y `mergedModelCatalog.ts`) — segunda vía que puede pegar `config.providers()` para el dropdown.
- `src/debug/SuggestionDebug.ts` — `logOpenCodeDebug` / toggle debug.
- `src/opencode/warmOpenCodeRuntime.ts`, `extension.ts` — puntos naturales para **preguntar caché** tras warm start.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| -------- | ------------- |
| Catálogo obsoleto (usuario cambia modelos en OpenCode) | Invalidación manual (comando/reload ventana); re-fetch tras error de modelo; documentar en README. |
| Reuso de sesión + estado contaminado entre prompts | Spike corto contra SDK/OpenCode docs; fallback a nueva sesión por suggest si hay error de invariante; tests de smoke. |
| Race al primer suggest antes de warm | Resolver con **single-flight** cache load; bloque corto igual que hoy en primera llamada pero **una sola vez** hasta invalidación. |
| Logs verbosos | Gating **estricto** con `debugSuggestions`; formato una línea por fase por request. |

---

## Política de tests

- **`npm run check`** tras cada hito.
- Tests **unitarios** del módulo de caché: single-flight doble llamada concurrente ⇒ un solo fetch mock; invalidación ⇒ segundo fetch.
- Mock `SdkClient.config.providers()` en tests de `opencodeLmCompletion` verificando **0 llamadas extras** cuando caché caliente (contador).

---

## Fases y criterios de aceptación

### Fase G — Caché de `config.providers` (prioridad alta)

| ID | Entregable | Criterio |
| ---- | ------------ | ---------- |
| G1 | Módulo `opencodeProvidersCache` (o nombre unificado en `src/opencode/`) | `getProvidersSnapshot(client): Promise<ProvidersPayload>` con cache/memoria proceso + mutex/single-flight. |
| G2 | `resolveOpencodeModelIds` refactor | Usa snapshot cacheado; no llama SDK directo cada vez si cache válido. |
| G3 | Paridad webview | Listado merged / OpenCode sólo usa la misma capa (`listOpencodeSuggestionModels` o equivalente refactor). |
| G4 | Invalidación documentada | Comportamiento enumerado en este doc + una viñeta en README (sección OpenCode perf). |

**Estado:** **Implementado (G1–G4)** — `src/opencode/opencodeProvidersSnapshot.ts` (caché + single-flight + `cacheValid` para payload vacío válido); `opencodeLmCompletion` + `opencodeModelCatalog` + warm prefetch; `invalidate` en `deactivate`; README «Model catalog cache».

---

### Fase H — Latencia de ciclo de sesión (`delete` asíncrono; reuse opcional)

| ID | Entregable | Criterio |
| ---- | ------------ | ---------- |
| H1 | `session.delete` no bloquea `return` | `requestOpencodeCompletion` resuelve al usuario sin esperar delete; SSE stop sigue seguro (`abort`/finally). |
| H2 | (Opc.) Pool de sesión | Si viable: **una sesión reusada** para sugerencias inline; tests manuales + fall back documentado si no. |
| H3 | Sin regresión cancel/token | Abort y timeout siguen cerrando SSE y opcionalmente `session.abort` como hoy. |

**Estado:** **Implementado** — Ya no hay `session.delete` en el camino exitoso (`opencodeLmCompletion`); **`getOrCreateOpencodeInlineSession`** en `src/opencode/opencodeInlineSuggestionSession.ts` reutiliza el mismo `sessionId` dentro de cada **ciclo `deploymentId`** (`OpenCodeRuntime.getDeploymentId()` sube en cada arranque/cierre embedded). Hooks `emitOpenCodeServerWillReset` / **`openCodeServerLifecycleHooks.ts`** invalidan pool antes del `close` del proceso. Invalidaciones extra: errores envolventes de `prompt`/`create`, cancel/timeout, `catch` exterior. `deactivate` llama **`invalidateOpencodeInlineSuggestionSessionPool`**. Sesión reused puede mantener histórico en OpenCode hasta invalidación — si molestara para inline, documentar rollback a create/delete por suggest.

---

### Fase I — Telemetría por fases (solo debug)

| ID | Entregable | Criterio |
| ---- | ------------ | ---------- |
| I1 | Helper `logOpenCodePerfCapture(captureId, phase, elapsedMs \ | deltaMs)` | Sólo emite si debug on. |
| I2 | Puntos instrumentados como mínimo | `providers` (cache-hit \ | resolved-after-await + `providers-network-fetch-ms` cuando hay red), **`session-create`** + **`inline-session`** ( pooled-reused \ | create ), primer delta SSE (`stream-first-delta` con opcional ms desde envío del `prompt`), **`prompt`** (`roundTripMs`), **`sse-consumer-settled`** (si hay streaming), **`opencode-lm-total`**. ~~`session.delete`~~ retirado del happy path en fase H. |
| I3 | No spam fuera de debug | asserts en tests o lint que llamadas sólo dentro de gated branch. |

**Estado:** **Implementado (I1–I3)** — `logOpenCodePerfCapture`; `perfCaptureId` en `CompletionRequestOptions` desde el webview (`handleGhostPromptSuggest`); LM + snapshot de providers sólo registran **`[opencode-perf]`** con capture cuando **`perfCaptureId`** está definido; catálogo/warm no pasan perf ⇒ sin líneas nuevas.

**Implementación:** [`SuggestionDebug.ts`](../../../src/debug/SuggestionDebug.ts) (`logOpenCodePerfCapture`), [`opencodeLmCompletion.ts`](../../../src/completion/providers/opencodeLmCompletion.ts), [`opencodeProvidersSnapshot.ts`](../../../src/opencode/opencodeProvidersSnapshot.ts), [`opencodeInlineSuggestionSession.ts`](../../../src/opencode/opencodeInlineSuggestionSession.ts).

---

### Fase J — Release notes

| ID | Entregable | Criterio |
| ---- | ------------ | ---------- |
| J1 | `CHANGELOG.md` | Entrada **[0.4.x]** citando perf OpenCode + debug perf logs. |

**Estado inicial:** Pendiente.

---

## Orden recomendado

1. **G** — mayor impacto inmediato con menor riesgo.
2. **H1** (`delete` async) — mejora cola perceptible rápido.
3. **I** — medición guía refinamiento **H2** (reuse sesión).
4. **J** — notas de release en CHANGELOG + README (opcional antes del corte marketplace; QA local VSIX permitido).

---

## Checklist (aditivo sobre 0.4)

- [x] Fase G — Caché compartida de catálogo OpenCode / single-flight / paridad dropdown / README.
- [x] Fase H — Sin `await session.delete`; pool de sesión inline + invalidez en reset servidor / abort / errores.
- [x] Fase I — Telemetría de fases (debug only).
- [x] Fase J — CHANGELOG **`[0.4.1]`** + README (debug **`[opencode-perf]`**).

---

## Bitácora

| Fecha | Nota |
| ------- | ------ |
| 2026-05-10 | Roadmap creado por acuerdo: reducir hot-path OpenCode (`providers`, create/delete por request), observabilidad en debug únicamente. |
| 2026-05-10 | Fase G (núcleo): `opencodeProvidersSnapshot`, warm prefetch, `invalidate` en `deactivate`, tests `opencodeProvidersSnapshot.test.ts` + regresión LM. |
| 2026-05-10 | Fase H: `openCodeServerLifecycleHooks` + `deploymentId`; pool `opencodeInlineSuggestionSession`; retirado delete por suggestion; invalidación ante abort/errors/close embedded. |
| 2026-05-10 | Fase I: líneas `[opencode-perf]` gated por debug + `perfCaptureId` en path suggest; puntos LM, providers snapshot, sesión inline, SSE primer delta/drenaje. |
| 2026-05-10 | Fase J: CHANGELOG **`[0.4.1]` pendiente de publicación**, README ampliado § Debug (`[opencode-perf]`), **`package.json` 0.4.1** para VSIX local vs marketplace **0.4.0**. |

---

## Referencias cruzadas

- Integración OpenCode original: [`Roadmap-v0.3-opencode-integration.md`](./Roadmap-v0.3-opencode-integration.md).
- Memoria proyecto v0.4 (otro eje del mismo número de versión): [`Roadmap-v0.4-project-context-store.md`](./Roadmap-v0.4-project-context-store.md).
- Código: [`src/completion/providers/opencodeLmCompletion.ts`](../../../src/completion/providers/opencodeLmCompletion.ts).
