# Roadmap v0.3.2 — Host modular, webview tipado y calidad continua

> **Versión objetivo:** **GhostPrompt 0.3.2** (deuda técnica focalizada tras webview 0.3.1: particionar host, opcionalmente modernizar cliente webview, contratos compartidos y tooling).
>
> **Antecedentes:** [`Roadmap-v0.3.1-webview-parity-contracts-ux.md`](./Roadmap-v0.3.1-webview-parity-contracts-ux.md) cerrado; auditoría e insumos en [`Spike-v0.3.2-src-audit-roadmap-input.md`](../Spikes/Spike-v0.3.2-src-audit-roadmap-input.md).

---

## Objetivo

1. **Reducir el “god object” del host:** extraer responsabilidades de `MiniInputViewProvider.ts` (~690 líneas) sin cambiar comportamiento observable (tests verdes).
2. **Opcional — camino a webview tipado:** spike de bundler (esbuild/vite) + TypeScript en `webview/`, manteniendo CSP y carga en VSIX coherentes.
3. **Contratos host ↔ webview alineados en compile-time:** compartir o generar schemas/tipos desde una fuente única cuando el pipeline del punto 2 exista (o documentar pasos intermedios).
4. **Calidad continua:** grafos de dependencias opcionales (madge), reglas ESLint de fronteras entre carpetas, límites blandos de tamaño de archivo.

---

## Política de tests (cada paso)

1. **Tras cada cambio sustantivo** en esta oleada: ejecutar **`npm run check`** (lint + `tsc` + vitest) y dejarlo verde antes de considerar el paso cerrado.
2. **Si el código que se toca no está cubierto** por un test existente: **añadir tests en el mismo paso** (misma PR / mismo batch de commits), priorizando:
   - regresión del comportamiento que se refactoriza (mensajes webview, settings, completion enrutado);
   - pruebas unitarias de **módulos nuevos** extraídos del host (entrada/salida pura cuando aplique).
3. **Refactors “solo mover código”:** mantener tests actuales pasando; si el extractor introduce API nueva pública, cubrir esa API mínimamente (no dejar helpers sin ningún test si tienen lógica propia).
4. **Fases B–C (webview/build):** donde no haya vitest viable (solo artefacto compilado), sustituir con **checks automatizables**: script que verifique que el bundle existe / tamaño / una ejecución node del bundle en modo smoke; documentar en la bitácora si algo queda solo manual por coste.

Esta política aplica a todas las fases A–D salvo nota explícita en bitácora.

---

## Alcance explícito no prioritario en esta oleada

| Tema | Decisión |
|------|----------|
| **Express / Nest / Next** | Fuera del núcleo de la extensión (sin servidor HTTP productivo). |
| **React + Zustand en webview** | Proyecto mayor; no requerido para cerrar 0.3.2; valorar solo si el spike del bundler lo justifica. |
| **Suite E2E completa (@vscode/test-electron)** | Opcional al final de la oleada; puede quedar como seguimiento si CI no lo absorbe. |

---

## Fase A — Ergonomía del host (refactor mecánico)

**Meta:** Particionar `MiniInputViewProvider` en módulos dedicados (mensajes webview, `_postSettings`, sugerencias, HTML helpers, etc.) sin cambiar protocolo ni tests de regresión.

**Estado:** Hecho (2026-05-10).

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **A1** | Extraer router o handlers por `message.type` (`init`, `suggest`, `draftChanged`, `updateSetting`, `send`, `accept`) | `MiniInputViewProvider` delega; cada handler en archivo o clase en `src/host/` con nombre estable. |
| **A2** | `_postSettings` / `_updateSetting` / `_getHtmlForWebview` fuera del cuerpo principal si superan umbral acordado (~80–120 líneas por unidad) | `npm run check` verde; mismo comportamiento que 0.3.1. |
| **A3** | Documentar en cabecera del provider la nueva composición | Comentario breve + enlaces a archivos extraídos. |
| **A4** | Tests | Donde exista lógica nueva o rutas no cubiertas por `MiniInputViewProvider.test.ts`, ampliar tests o añadir `tests/host/*.test.ts`; ver **Política de tests**. |

**Definición de hecho (fase A):** Ningún archivo nuevo obligatorio supera de forma indefensa ~400 líneas por archivo host (salvo datos/tablas); tests existentes de host pasan sin relajar aserciones; **huecos de cobertura en código tocado** cubiertos o justificados en bitácora.

**Referencias:** `src/host/MiniInputViewProvider.ts`, `tests/MiniInputViewProvider.test.ts`.

---

## Fase B — Spike webview: bundler + TypeScript (opcional pero recomendado)

**Meta:** Demostrar pipeline `webview/**/*.ts` → bundle único consumido por `index.html`, con CSP nonce siguiendo documentación VS Code.

**Estado:** Hecho (2026-05-10).

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **B1** | Elegir herramienta (esbuild o Vite lib) y script `npm run build:webview` | Salida clara (p. ej. `webview/dist/main.js` o sobreescritura controlada); documentado en README *Developing*. |
| **B2** | Migrar al menos un módulo real desde `main.js` (p. ej. protocolo de mensajes o utilidades) | Typecheck estricto; sin regresión manual básica (abrir vista, teclear, sugerencia). |
| **B3** | Integrar en `vscode:prepublish` o `npm run compile` según impacto en flujo | VSIX empaqueta el asset correcto. |
| **B4** | Tests / smoke | Al menos: `npm run check` tras integrar build; si hay lógica TS extraída testeable en Node, tests vitest; si no, script/documento de verificación del artefacto (ver **Política de tests**). |

**Definición de hecho (fase B):** Un desarrollador puede editar el webview en TS y generar el JS que carga la extensión, con instrucciones en documentación; **regresión automatizada o checklist script** acordada.

**Nota:** Si B se pospone, la Fase C puede limitarse a “documentar duplicación consciente” hasta existir build.

---

## Fase C — Contratos compartidos (alineación compile-time)

**Meta:** Que cambios en payloads `postMessage` fallen en **cliente y host** cuando haya build compartido, o un plan B documentado (p. ej. generación de tipos desde Zod).

**Estado:** Hecho (2026-05-10).

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **C1** | Carpeta `shared/` o paquete workspace con schemas/tipos reexportados | Sin import circular host ↔ webview en runtime de extensión (el bundle webview empaqueta copias o imports resueltos en build). |
| **C2** | Reglas o checklist: al cambiar `webviewProtocols.ts`, ejecutar build webview + tests | Descrito en roadmap bitácora o README. |
| **C3** | (Opcional) Validación ligera en cliente generada o copiada desde mismos Zod | Reduce drift respecto a solo-host Zod. |
| **C4** | Tests | Ampliar `webviewProtocols.test.ts` (o tests del módulo `shared/`) para cada variante de mensaje que se comparta; **Política de tests**. |

**Definición de hecho (fase C):** Lista explícita en doc de “cómo no romper contratos”; si hay TS webview, errores de tipo en CI al desalinear mensajes; **schemas compartidos con casos de prueba** alineados.

---

## Fase D — Calidad continua y fronteras

**Meta:** Visibilidad de dependencias y convenciones sin frenar desarrollo diario.

**Estado:** Hecho (2026-05-10).

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **D1** | Script `npm run deps:graph` (madge u homólogo) opcional | Documentado; no obligatorio en CI en primera iteración. |
| **D2** | ESLint: `import/no-restricted-paths` o equivalente para capas sensibles (`opencode` ↔ `host`) | Config mínima acordada; sin falsos positivos masivos. |
| **D3** | Umbral warning LOC por archivo (opcional, eslint-plugin o convención doc) | Equipo alinea número máximo “blando” para nuevos PRs. |
| **D4** | Tests CI | Si el script `deps:graph` o ESLint nuevos se integran en `npm run check` o job opcional, documentar y validar que no rompen el flujo local. |

**Definición de hecho (fase D):** CONTRIBUTING o README con una subsección “Arquitectura y dependencias” enlazando este roadmap; **comando de validación** reproducible.

---

## OpenCode (transversal, no bloqueante)

Documentar en `Docs/` o `ARCHITECTURE.md` las capas: **runtime** (`OpenCodeRuntime`), **completion** (`opencodeLmCompletion`), **debug SSE** (`opencodeSseDebug`). Objetivo: bumps de `@opencode-ai/sdk` con checklist de archivos a tocar.

---

## Orden recomendado

1. **Fase A** primero (mayor ROI, sin infra nueva).
2. **Fase B** en paralelo o tras A si hay capacidad (infra webview).
3. **Fase C** cuando B exista o como documentación estricta si B se aplaza.
4. **Fase D** puede iniciarse en paralelo con A (bajo riesgo).

---

## Checklist global de versión 0.3.2

- [ ] **Política de tests** respetada en cada PR/paso (`npm run check`; tests nuevos donde faltaba cobertura en código tocado).
- [x] Fase A — Partición `MiniInputViewProvider`.
- [x] Fase B — Spike bundler + TS webview (o decisión explícita de aplazar con nota).
- [x] Fase C — Contratos compartidos / plan anti-drift.
- [x] Fase D — Tooling dependencias + ESLint fronteras + doc.
- [ ] `CHANGELOG.md` y `package.json` → **0.3.2** al publicar.
- [ ] QA manual breve (abrir Sidebar + Panel, sugerencia, OpenCode si aplica).

---

## Bitácora

| Fecha | Nota |
|-------|------|
| 2026-05-09 | Roadmap creado desde spike [`Spike-v0.3.2-src-audit-roadmap-input.md`](../Spikes/Spike-v0.3.2-src-audit-roadmap-input.md). |
| 2026-05-09 | Añadida **Política de tests** y filas A4/B4/C4/D4 (cobertura en cada fase). |
| 2026-05-10 | **Fase A:** router `dispatchGhostPromptInboundMessage` en `ghostPromptWebviewInboundHandlers.ts`; getters workspace en `ghostPromptHostWorkspaceGetters.ts`; cabecera de composición en `MiniInputViewProvider.ts`; tests `tests/host/ghostPromptWebviewInboundHandlers.test.ts`. |
| 2026-05-10 | **Fase B:** esbuild → `webview/dist/main.js`; fuentes en `webview/src/` (módulos `lib/htmlEscape`, `composeLabels`, `userErrorMessage` + `main.ts`); `ghostPromptWebviewHtml` apunta a `dist/main.js`; `npm run build:webview`, `typecheck:webview`, `verify:webview-bundle`; README *Developing*; `.gitignore` usa `/dist/` para no ignorar `webview/dist/`. |
| 2026-05-10 | **Fase C:** schemas Zod en `src/shared/webviewMessageSchemas.ts`; host `webviewProtocols.ts` reexporta + parse en borde; webview `protocol/postToHost.ts` valida salida; tests `tests/shared/webviewMessageSchemas.test.ts`; README subsección *Webview ↔ host message contracts* y checklist `npm run check`. |
| 2026-05-10 | **Fase D:** `npm run deps:graph` / `deps:circular` (madge); ESLint `import/no-restricted-paths` (`src/opencode` → no `src/host`); README *Architecture and dependencies* con línea base LOC; validación = `npm run check` (lint incluye fronteras). |

---

## Referencias cruzadas

- Auditoría métricas y debilidades: [`Spike-v0.3.2-src-audit-roadmap-input.md`](../Spikes/Spike-v0.3.2-src-audit-roadmap-input.md).
- Contratos actuales: `src/host/webviewProtocols.ts`.
- Roadmap previo UI: [`Roadmap-v0.3.1-webview-parity-contracts-ux.md`](./Roadmap-v0.3.1-webview-parity-contracts-ux.md).
- Siguiente línea (contexto de repo): [`Roadmap-v0.4-project-context-store.md`](./Roadmap-v0.4-project-context-store.md).
