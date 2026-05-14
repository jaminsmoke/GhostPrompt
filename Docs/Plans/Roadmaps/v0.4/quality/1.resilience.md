# Roadmap v0.4.3 — Calidad y resiliencia (post-auditoría interna)

> **Versión objetivo:** trabajo distribuible en **0.4.2** (parcial) y/o **0.4.3** según se cierren fases.  
> **Origen:** auditoría de puntos débiles (pipeline, CI OpenCode, errores UX, tipos SDK, dual webview).  
> **Metodología:** igual que v0.4.2 LM audit — **auditoría / hallazgos → pasos derivados → implementación → cierre** por fase, **una fase activa**.

---

## Antes de publicar **0.4.2** (checklist editorial)

Al subir versión en `package.json`, revisar que **CHANGELOG.md** y **README.md** mencionen al menos:

| Tema ya en código | Dónde suele ir |
| ------------------- | ---------------- |
| Auditoría LM v0.4.2 (Fases 1–4), tablas `ARCHITECTURE.md` §3 | CHANGELOG [0.4.2] Docs / Changed |
| Copilot: dos mensajes `User`, `buildCompletionInstructionParts` | CHANGELOG Changed |
| Contrato instruction ↔ normalize + tests | CHANGELOG Added / Tests |
| Sin `@vscode/prompt-tsx`; catálogo = integración | CHANGELOG Docs breve |
| OpenCode: docs eficiencia inline §3 | CHANGELOG Docs |

Si algo queda fuera del changelog, **añadirlo** en el mismo bump o en la siguiente patch.

---

## Fase 1 — Matriz de tests del pipeline `suggest`

### Objetivo

Reducir regresiones en `ghostPromptSuggestPipeline` / deps cuando cambian **contextMode** (`off` | `basic` | `project`), **fuente** (Copilot vs OpenCode) o **errores** del LM (empty, timeout, error).

### Auditoría inicial

- [x] Inventariar ramas existentes en `runGhostPromptSuggestPipeline` (memoria proyecto, bootstrap, loading phases).
- [x] Listar tests actuales (`ghostPromptSuggestPipeline.test.ts`, `MiniInputViewProvider.test.ts`, handlers).
- [x] Identificar combinaciones **no** cubiertas (p. ej. `project` + mock reconcile; OpenCode path con mock provider).

### Hallazgos

| Hueco previo | Cobertura añadida |
| -------------- | ------------------- |
| `contextMode` solo `basic` en test | `off` (sin señales sesión en `context`) y `basic` (con `lastSentPrompt` / `recentSentPrompts` recortados). |
| `project` sin assert de `projectBootstrapLines` | Mock `resolveGhostPromptWorkspaceFolderUri` + `collectProjectBootstrapPieces` → `projectBootstrapLines` + `collectProjectContext` en el prompt. |
| Fuente LM siempre implícita Copilot | `resolveCompletionSourceForRequest` → `opencode`: fase `opencode-start` y `onStreamPreview` en opciones. |
| Resultados `empty` / `error` | Broadcast `empty` con `reason` y `error` con `message`. |
| Reconcile + `writeGhostPromptBootstrapSnapshot` | **Pendiente** (test más pesado; opcional Fase 1+ o dejar a integración). |

### Pasos derivados

1. Ampliar `tests/host/ghostPromptSuggestPipeline.test.ts` (6 casos nuevos + `getCompletionProviderForSource` por `source`).
2. Mock `vscode.Uri` en el harness de test para `Uri.file`.
3. Restaurar spy `resolveCompletionSourceForRequest` tras test OpenCode (orden estable entre tests).

### Criterio de hecho

Nuevos tests o extensiones que cubran al menos **dos combinaciones nuevas** documentadas arriba; `npm run check` verde.

### Estado

- [x] Auditoría cerrada
- [x] Implementación cerrada

---

## Fase 2 — OpenCode: release checklist + CI opcional

### Objetivo (Fase 2)

Que una release no dependa solo de la suite unitaria: integración real **documentada** y, si el repo dispone de runner adecuado, job **opcional** con `GHOST_PROMPT_OPENCODE_INTEGRATION=1`.

### Auditoría inicial (Fase 2)

- [x] Releer `tests/opencodeSuggestions.integration.test.ts` y variables de entorno.
- [x] Decidir: ¿README “Release checklist”, snippet GitHub Actions, o solo documentación en este roadmap?

### Hallazgos (Fase 2)

| Decisión | Detalle |
| ---------- | --------- |
| Documentación | [`Docs/Plans/Releasing-opencode-integration.md`](./Releasing-opencode-integration.md) — checklist `npm run check` + integración opcional; tabla workflows. |
| README | Párrafo tras “OpenCode integration tests” enlazando releasing + resumen CI/GitHub. |
| CI estándar | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `npm run check` en push/PR a `main`. |
| Integración OpenCode | [`.github/workflows/opencode-integration.yml`](../../.github/workflows/opencode-integration.yml) — solo **`workflow_dispatch`**; exige `opencode` en PATH (runner self-hosted o instalar CLI). |

### Pasos derivados (Fase 2)

1. Crear workflows anteriores + doc releasing.
2. Tras el primer push: verificar que Actions ejecuta **CI** en el repo.

### Criterio de hecho (Fase 2)

Checklist reproducible en docs; CI opcional explícitamente *skipped* o *manual* si no aplica.

### Estado (Fase 2)

- [x] Auditoría cerrada
- [x] Implementación cerrada

---

## Fase 3 — Mensajes de error visibles (sin depender del debug)

### Objetivo (Fase 3)

Cuando `suggestion` falle o devuelva `empty` por causas **accionables** (sin Copilot, cuota, OpenCode no arranca, timeout), el usuario recibe una pista breve en UI o `window.showWarningMessage` **opcional y no intrusiva**, sin volcar stack traces.

### Auditoría inicial (Fase 3)

- [x] Mapear razones `empty` / `error` desde completion hasta webview (`broadcastUi`).
- [x] Clasificar: ¿usuario puede actuar (instalar Copilot, revisar OpenCode) vs transitorio?

### Hallazgos (Fase 3)

| Tema | Detalle |
| ------ | --------- |
| Razones `empty` | `CompletionResult` (`types.ts`) → host `broadcastUi` → webview `empty`; `empty-response` antes caía en texto genérico. |
| Errores `error` | Host envía `message` crudo; webview `toUserErrorMessage` añadía solo prefijo/truncado; sin guía para cuota premium / arranque OpenCode / red. |
| Accionable vs transitorio | Cuota premium, OpenCode no arranca, 401/403, rate limit → pistas breves; demás → mensaje compacto sin stack. |
| Host opcional | `ghostPrompt.showSuggestionIssueNotifications` + `maybeNotifySuggestionIssue` tras `broadcastUi` (`suggestionHostNotification.ts`): solo `empty` accionables (`no-model`, `no-included-model`, `premium-quota-blocked`) y `error` con heurística; throttle ~90s por clave. |

### Pasos derivados (Fase 3)

1. Centralizar textos `empty` en `webview/src/lib/userErrorMessage.ts` (`messageForEmptySuggestion`), incl. **`empty-response`** explícito.
2. Heurísticas en `toUserErrorMessage` para substrings frecuentes (cuota premium, `Failed to start OpenCode`, red, HTTP 401/403, 429).
3. Tests en `tests/webview/userErrorMessage.test.ts`.
4. Avisos VS Code opcionales en host (`showSuggestionIssueNotifications`, throttle, tests pipeline + `suggestionHostNotification.test.ts`).

### Criterio de hecho (Fase 3)

Al menos **una** razón frecuente con mensaje mejorado + tests o snapshot de protocolo si aplica.

### Estado (Fase 3)

- [x] Auditoría cerrada
- [x] Implementación cerrada

---

## Fase 4 — Tipos estrechos para envelopes SDK OpenCode

### Objetivo (Fase 4)

Sustituir gradualmente `unknown` / casts amplios por tipos **locales** (solo campos que parseamos: `session.create`, `prompt` result, `providers` envelope) para fallar en compile cuando cambie el SDK.

### Auditoría inicial (Fase 4)

- [x] Localizar `as unknown`, envelopes en `opencodeLmCompletion.ts`, `opencodeInlineSuggestionSession.ts`, `opencodeProvidersSnapshot.ts`.
- [x] Comparar con tipos exportados por `@opencode-ai/sdk` si existen.

### Hallazgos (Fase 4)

| Tema | Detalle |
| ------ | --------- |
| SDK npm | No se depende de `.d.ts` publicados en el paquete instalado; contratos **locales** en `src/opencode/sdkEnvelope.ts`. |
| Duplicación | `readSdkData` / `getResultData` / lectura de error repetían la forma `{ data?, error? }`. |
| Alcance | Tipos estrechos solo para **session.create data**, **prompt `data`**, envelope genérico y **providers** snapshot (unwrap tipado). |

### Pasos derivados (Fase 4)

1. Añadir `sdkEnvelope.ts` (`OpencodeApiEnvelope`, `OpencodePromptResultData`, helpers unwrap/failure/concat/unpack session id).
2. Refactor: `opencodeLmCompletion.ts`, `opencodeInlineSuggestionSession.ts`, `opencodeProvidersSnapshot.ts`.
3. Tests unitarios `tests/sdkEnvelope.test.ts`.

### Criterio de hecho (Fase 4)

Tipos mínimos documentados + tests existentes pasando; sin regresión en bundle.

### Estado (Fase 4)

- [x] Auditoría cerrada
- [x] Implementación cerrada

---

## Fase 5 — Dual webview (sidebar + panel): gobernanza

### Objetivo (Fase 5)

Evitar divergencias entre vistas al cambiar toolbar/CSS/protocolo: checklist corto al tocar `webview/` o mensajes compartidos.

### Auditoría inicial (Fase 5)

- [x] Confirmar que `webviewToolbarParity.test.ts` y esquemas cubren los cambios recientes.

### Hallazgos (Fase 5)

| Tema | Detalle |
| ------ | --------- |
| Paridad HTML/CSS/IDs | `webviewToolbarParity.test.ts` ya ancla chips, ids del toolbar y bloque `gp-cap-compact-toolbar`. |
| Contratos Zod | `webviewProtocols.test.ts` + `src/shared/webviewMessageSchemas.ts` cubren entrada webview→host y envelope `settings`. |
| Dual vista real | Un solo `MiniInputViewProvider` + `buildGhostPromptWebviewHtml`; broadcast `_broadcastUi` / `_broadcastDraftSync` — sin segundo bundle. |

### Pasos derivados (Fase 5)

1. README: subsección **Dual webview (sidebar + panel) — contributor checklist** con tabla (bundle único, capabilities, copy compartido, tests).
2. Ampliar `webviewToolbarParity.test.ts` con bloque **dual-view governance** (`ghostPromptWebviewHtml.ts`, `MiniInputViewProvider.ts`, imports `userErrorMessage` en `main.ts`).

### Criterio de hecho (Fase 5)

Documentación o test añadido; `npm run check` verde.

### Estado (Fase 5)

- [x] Auditoría cerrada
- [x] Implementación cerrada

---

## Bitácora global

| Fecha | Fase | Nota |
| ------- | ------ | ------ |
| 2026-05-10 | — | Roadmap creado a partir de auditoría interna (pipeline, CI OpenCode, errores UX, tipos SDK, dual webview). |
| 2026-05-10 | Fase 1 | Tests matriz suggest: `off`/`basic`/`project`, OpenCode loading + stream callback, `empty`/`error`; `ghostPromptSuggestPipeline.test.ts`. |
| 2026-05-10 | Fase 2 | `Releasing-opencode-integration.md`, README, `ci.yml`, `opencode-integration.yml` (manual). |
| 2026-05-10 | Fase 3 | Mensajes UX: `messageForEmptySuggestion` + `empty-response`; `toUserErrorMessage` con heurísticas; tests `userErrorMessage.test.ts`. |
| 2026-05-10 | Fase 3+ | Avisos host: `suggestionHostNotification.ts`, setting `showSuggestionIssueNotifications`, throttle 90s. |
| 2026-05-10 | Fase 4 | Contratos locales SDK OpenCode en `sdkEnvelope.ts`; refactor envelopes LM/session/providers + `sdkEnvelope.test.ts`. |
| 2026-05-10 | Fase 5 | README checklist dual webview + tests gobernanza en `webviewToolbarParity.test.ts`. |

---

## Referencias

- [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) §3 (OpenCode / catálogo)
- [`Docs/Owners.md`](../../Owners.md)
- [`Roadmap-v0.4.2-lm-efficiency-audit.md`](./Roadmap-v0.4.2-lm-efficiency-audit.md)
