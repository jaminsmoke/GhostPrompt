# Roadmap — Integración OpenCode en GhostPrompt (v0.3.x)

> **Estado:** Primera versión ejecutable — listo para spike puntual y fases de implementación.  
> **Depende de:** [Reestructuración `src` / `CompletionProvider`](./Roadmap-v0.3.0-architecture.md) *(arquitectura cerrada en repo).*  
> **Referencia SDK:** [OpenCode SDK](https://opencode.ai/docs/sdk) (`@opencode-ai/sdk`), tipos generados desde OpenAPI del servidor.

## Objetivo

Ofrecer **suggestions** mediante el runtime **OpenCode** como alternativa opt-in al motor actual **Copilot `vscode.lm`**, reutilizando el contrato `CompletionProvider` y el resto del pipeline (governor, normalización, webview) sin duplicar lógica innecesaria.

---

## Principios de producto

1. **Por defecto:** proveedor **Copilot LM** — comportamiento actual sin cambios para quien no opte por OpenCode.
2. **Configuración global por proveedor:** un setting único elige el motor de completion (`copilot` | `opencode`; nombres finales bajo `ghostPrompt.*` al implementar). **No** se enruta por modelo entre proveedores; el usuario elige proveedor y luego modelo **dentro** del catálogo de ese proveedor.
3. **Catálogo honesto:** solo se muestran modelos OpenCode cuando el runtime GhostPrompt puede listarlos (CLI/servidor OK). Si OpenCode no está instalado o no arranca, **no** se muestran entradas OpenCode en el selector (evitar opciones rotas).
4. **Exclusiones:** settings opcionales para ocultar modelos concretos del listado (detalle de formato tras el spike, cuando conozcamos ids estables de `config.providers()`).
5. **Tiers más adelante:** clasificación tipo included / premium / free para modelos OpenCode **en una fase posterior**, análoga a Copilot (`modelCatalog` / metadatos), sin bloquear el primer embudo funcional.
6. **Transparencia:** mensajes claros si falta CLI, falla el arranque del servidor dedicado o falta auth según proveedor; GhostPrompt no redefine políticas de precio — enlazar doc OpenCode / proveedor.

---

## Principios técnicos

### Instancia dedicada GhostPrompt

- GhostPrompt **siempre** usa **su propia** instancia del servidor OpenCode (p. ej. vía `createOpencode()` del SDK), con **puerto y proceso bajo control de la extensión**.
- Si el usuario tiene otra sesión OpenCode para otros proyectos, **no** debe interferir: otro puerto / otro proceso; GhostPrompt solo conecta a **su** `baseUrl`.
- Ciclo de vida: **levantar** el runtime cuando el usuario seleccione el proveedor OpenCode (y el CLI esté disponible); **detenerlo** al volver a Copilot o al desactivar el uso, para no mantener carga en segundo plano innecesaria. *(Ajuste fino: debounce de apagado opcional si hay conmutación rápida — medir en spike.)*

### Detección de instalación CLI

- Comprobación ligera: `opencode --version` (o equivalente documentado). Exit 0 + salida útil → asumir CLI en PATH; si no, mensaje claro — **PATH incorrecto no es “bug” de GhostPrompt**, solo estado no disponible.
- Implementación con `spawn`/`execFile`, **timeout** corto, **cache** por sesión o TTL para no spamear en cada operación.

---

## Fase 0 — Spike (entregables documentados)

Objetivo: validar en máquina real los puntos que fijan el diseño antes de codificar el proveedor completo. Salida recomendada: `Docs/Plans/Spikes/OpenCode-spike-findings.md` (crear al cerrar el spike).

| ID | Entregable | Qué validar |
|----|------------|-------------|
| **A** | Contrato de arranque | `createOpencode()` con `hostname`, `port`, `timeout`, `AbortSignal`; `config` inline si hace falta aislar proyecto. |
| **B** | Aislamiento | Dos servidores en puertos distintos coexisten; documentar carpeta de trabajo / `opencode.json` si aplica para no mezclar con otros usos. |
| **C** | Catálogo | `client.config.providers()` — forma de `Provider`, ids, defaults; cómo mapear a ids estables en GhostPrompt. |
| **D** | Camino sugerencia | `session.create` → `session.prompt` con `model: { providerID, modelID }` y texto corto; sesión por request vs reutilizada. |
| **E** | Streaming | ¿Tokens parciales vía `event.subscribe()` (SSE) o solo respuesta final en `session.prompt`? Cómo cablear al pipeline actual de streaming. |
| **F** | Cancelación | `session.abort` durante generación; alineación con cancelación del `SuggestionRequestGovernor`. |
| **G** | Apagado | Cierre limpio (`server.close()` o equivalente); sin procesos huérfanos. |
| **H** | Dependencias | Peso de `@opencode-ai/sdk` en bundle; versión a fijar; relación CLI vs binario embebido si la doc lo exige. |

**Criterio de salida Fase 0:** documento de hallazgos con decisiones cerradas en A–H y una tabla modelo OpenCode ↔ campos API (`providerID`, `modelID`, …).

---

## Fase 1 — Runtime y detección

- [x] Módulo **`OpenCodeRuntime`** (`src/opencode/OpenCodeRuntime.ts`): `start()`, `stop()`, `isHealthy()`, `getClient()` / `getBaseUrl()`; instancia singleton por proceso de extensión; arranque con `createOpencode()` (import dinámico del SDK ESM).
- [x] Detección `opencode` / `opencode.cmd` + `--version`, **TTL 5 min**, opción `invalidateOpenCodeCliCache()`; mensajes VS Code si falla CLI o servidor al sincronizar configuración.
- [x] Puerto dedicado **17433** (`GHOST_PROMPT_OPENCODE_PORT`) para no chocar con otra instancia OpenCode del usuario; documentado en bitácora.

---

## Fase 2 — `CompletionProvider` OpenCode

- [x] Implementar `CompletionProvider` en `src/completion/providers/opencodeLmCompletion.ts`: `session.create` → `session.prompt` con `model` + partes de texto; limpieza con `session.delete`; `session.abort` ante cancelación o timeout.
- [x] Conectar **`getActiveCompletionProvider()`** a `ghostPrompt.completionProvider` (`copilot` | `opencode`).
- [x] Manejo de errores (envelope SDK + `info.error` en prompt) y timeout alineado con `requestTimeoutMs` + `CancellationToken`.

---

## Fase 3 — Modelos en webview

- [x] Cuando proveedor = OpenCode y runtime OK: poblar selector desde **`listOpencodeSuggestionModels`** → `config.providers()` (tras `runtime.start()`).
- [x] Cuando proveedor = Copilot: **`listSuggestionModels`** (`vscode.lm`) sin mezclar catálogos.
- [x] Badge **Motor: Copilot LM** / **Motor: OpenCode** + opción Auto distinta (`Auto (policy)` vs `Auto (OpenCode)`); mensaje `no-model` contextual.
- [x] Setting **`ghostPrompt.opencodeExcludedModelIds`** (array de ids `providerID/modelID`) para ocultar modelos del dropdown.

---

## Fase 4 — Calidad y documentación

- [x] Tests con **mocks** de `OpenCodeRuntime` / envelope SDK (`tests/opencodeModelCatalog.test.ts`, `tests/opencodeLmCompletion.test.ts`); **sin** red en CI.
- [x] README: requisitos OpenCode, tabla proveedor, settings `completionProvider` / exclusiones, enlaces [OpenCode SDK](https://opencode.ai/docs/sdk) y roadmap.
- [x] **CHANGELOG** `[0.3.0]`: sección **Added** (OpenCode, tests), **Changed** (VSIX con dependencias), **Docs**; nota de tag opcional. **README** badge de versión ya era 0.3.0 — sin cambio de número.

---

## Fuera de alcance (primera entrega)

- Paridad completa de tiers included/premium OpenCode (Fase posterior).
- Integración con otra extensión VS Code solo para OpenCode UI (no bloquea este roadmap).
- Empaquetado VSIX “final” si el release global 0.3.0 sigue acumulando ítems — coordinar con [notas de release en CHANGELOG](../../CHANGELOG.md).

---

## Definición de hecho (integración OpenCode usable)

- Setting global de proveedor + runtime dedicado estable en escenarios documentados.
- Suggestions OpenCode con cancelación y sin fugas de proceso obvias al cambiar a Copilot.
- Selector de modelos coherente con disponibilidad real + exclusiones opcionales *(exclusiones pueden ser iteración rápida tras lista estable)*.
- `npm run check` verde.
- Hallazgos del spike archivados y roadmap actualizado si hubo desviaciones.

---

## Bitácora de desviaciones

- **Fase 1 — Puerto:** servidor embebido GhostPrompt en **127.0.0.1:17433** (`constants.ts`). Salud comprobada con `client.config.get()` (la superficie `global.health()` no está en todas las versiones del SDK tipado).
- **Fase 2 — Modelo OpenCode:** hasta la UI de modelos (Fase 3), `ghostPrompt.selectedModelId` puede ser `providerID/modelID`; si es `auto` o id no parseable, se usa `config.providers()` (defaults y primer modelo disponible).
- **VSIX:** script `npm run vsix` usa `vsce package` **sin** `--no-dependencies` para incluir `@opencode-ai/sdk` y demás dependencias de runtime.
- **Fase 3:** cualquier cambio bajo `ghostPrompt.*` dispara `MiniInputViewProvider.refreshSettingsAllViews()` para refrescar lista de modelos sin recargar ventana.
- **Fase 4:** tests Vitest sin red; documentación usuario en README + CHANGELOG bajo **0.3.0**.
- *(Siguientes mejoras: streaming explícito, tiers OpenCode, etc.)*
- **Seguimiento v0.3.0c:** UX de fases de carga, rendimiento cold start, multi‑proveedor y revisión SDK → [`Roadmap-v0.3.0c-opencode-ux-perf.md`](./Roadmap-v0.3.0c-opencode-ux-perf.md).

---

## Referencias rápidas API SDK (para implementación; sujetas al spike)

| Necesidad | API documentada |
|-----------|-----------------|
| Arranque integrado | `createOpencode()`, opciones `hostname`, `port`, `timeout`, `signal`, `config` |
| Cliente solo | `createOpencodeClient({ baseUrl })` |
| Salud | `client.global.health()` |
| Modelos / proveedores | `client.config.providers()`, `client.config.get()` |
| Prompt | `client.session.prompt({ path, body })` con `parts`, `model` |
| Abort | `client.session.abort({ path })` |
| Eventos | `client.event.subscribe()` (streaming / SSE) |