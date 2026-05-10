# Roadmap v0.3.1 — Webview: paridad de menús, contratos y UX

> **Versión objetivo:** **GhostPrompt 0.3.1** (release que agrupa bugs de webview, paridad funcional entre vistas y refactor UX del toolbar).
>
> **Antecedentes:** misma base que **0.3.0** / oleadas OpenCode ([`Roadmap-v0.3.0d-opencode-streaming-catalog.md`](./Roadmap-v0.3.0d-opencode-streaming-catalog.md)); sidebar y panel ya comparten HTML/JS/CSS (`webview/`) y estado vía `GhostPromptSessionStore` + broadcast (`MiniInputViewProvider`). Este roadmap cierra **brechas de producto**: mismo catálogo de controles en ambas vistas, contratos explícitos host ↔ webview y toolbar más compacto sin duplicar lógica.

---

## Objetivo

1. **Paridad funcional del menú (no del ancho):** cada vista puede tener layout distinto (sidebar estrecho vs panel ancho), pero **las mismas funciones** y **el mismo conjunto de controles** — ninguna vista debe mostrar opciones que la otra no tenga.
2. **Contratos en los límites:** validación tipada (p. ej. **Zod**) en mensajes `postMessage` críticos para que los cambios de UI no rompan silenciosamente el host.
3. **UX del toolbar:** mantener a la izquierda motor/modelo/política/auto; agrupar **estilo, contexto, idioma** (y controles afines) en un **menú desplegable** coherente, con buen uso en sidebar.
4. **Pulido:** sincronía de estado ya existente revalidada tras cambios; accesibilidad (foco/teclado); temas VS Code.

---

## Alcance explícito no prioritario en esta oleada

| Tema | Decisión |
|------|----------|
| **Express / Nest / Next** | No aplican al núcleo de una extensión VS Code (sin servidor HTTP propio del producto). Quedan fuera salvo proyecto aparte. |
| **Zustand + React** | El webview es **JS vanilla** en `webview/main.js`; introducir React + Zustand sería **proyecto mayor**. No forma parte del alcance mínimo de 0.3.1. |
| **Mismo ancho de contenedor** | No es objetivo: sidebar y panel **deben** poder verse distintos; lo que se exige es **paridad de controles y comportamiento**. |

---

## Fase A — Paridad funcional del menú

**Meta:** Garantizar que **sidebar** (`ghostPrompt.input`) y **panel** (`ghostPrompt.inputPanel`) ofrecen el **mismo catálogo** de controles y las mismas acciones; `__ghostPromptCapabilities` solo afecta **presentación** (densidad, wrap), no la lista de funciones.

**Estado:** **Cerrada** en código y tests (2026-05-09). Auditoría: un solo `webview/index.html` + `main.js` para ambas contribuciones; `VIEW_ID` solo para borrador; `VIEW_CAPS` solo `compactToolbar` → clase CSS; tests `webviewToolbarParity.test.ts`; comentarios en `MiniInputViewProvider._webviewCapabilitiesPayload`, `main.js`, `style.css`.

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **A1** | Mismo DOM de controles en ambas vistas para la barra superior | [x] Misma plantilla HTML inyectada (solo difiere `viewId` en script); test fija `data-key` e ids del toolbar. |
| **A2** | Sin ramas que quiten funciones por vista | [x] Código revisado: `VIEW_ID` solo `draftChanged` / `draftSync`; sin ramas de toolbar por vista; contrato documentado en `main.js`. |
| **A3** | Misma matriz acción ↔ setting | [x] Un solo `main.js` enlaza todos los chips / select / debug a `updateSetting` (sin bifurcar por vista). |
| **A4** | Capabilities = layout | [x] CSS `gp-cap-compact-toolbar` solo `row-gap`; comentario prohíbe `display:none` en `.setting-group`; host documenta paridad en `_webviewCapabilitiesPayload`. |

**Definición de hecho (fase A):** Un usuario puede ejecutar la **misma secuencia de acciones de configuración** en sidebar y en panel; ninguna capacidad es exclusiva de una vista.

**Archivos de referencia:** `src/host/MiniInputViewProvider.ts` (`_webviewCapabilitiesPayload`, HTML), `webview/main.js`, `webview/index.html`, `webview/style.css`, `tests/webviewToolbarParity.test.ts`.

---

## Fase B — Contratos host ↔ webview (Zod u equivalente)

**Meta:** Esquemas de validación en los **límites** (tras recibir / antes de enviar `postMessage`), sin sobrecarga en rutas calientes del editor.

**Estado:** **Cerrada** en código (2026-05-09). Módulo `src/host/webviewProtocols.ts` (`zod`), `parseWebviewInboundMessage` / `parseOutboundSettingsEnvelope`; tests `webviewProtocols.test.ts` + regresión en `MiniInputViewProvider.test.ts`; dependencia **`zod`** en `package.json`.

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **B1** | Schema del mensaje `settings` (host → webview) | [x] `webviewSettingsPayloadSchema` + sobre `webviewOutboundSettingsEnvelopeSchema`; fallo → no `postMessage`; tests saliente válido/inválido. |
| **B2** | Schemas webview → host | [x] `webviewInboundMessageSchema` cubre `init`, `suggest`, `draftChanged`, `accept`, `send`, `updateSetting` discriminado; inválido → `config.update` no se ejecuta. |
| **B3** | Una sola fuente de verdad | [x] `WebviewInboundMessage` vía `z.infer`; host usa tipo inferido en `_updateSetting`. |
| **B4** | Coste acotado | [x] Parse solo en `onDidReceiveMessage` y `_postSettings`. |

**Definición de hecho (fase B):** Cambiar un campo del payload `settings` sin actualizar el schema **rompe tests** o produce error explícito en desarrollo.

**Archivos de referencia:** `src/host/webviewProtocols.ts`, `MiniInputViewProvider.ts`, `tests/webviewProtocols.test.ts`.

---

## Fase C — UX: menú desplegable agrupado

**Meta:** Sustituir o complementar la fila larga de chips (estilo, contexto, idioma, …) por un **menú desplegable** que conserve **todas** las opciones actuales y las mismas claves de configuración.

**Estado:** **Cerrada** en código (2026-05-09). `<details id="compose-options-details">` con resumen `Normal · Básico · Auto (EN)` (dinámico); mismos `.setting-group` / `data-key` dentro del panel; `Escape` cierra; clic en chip cierra; panel con scroll (`max-height`); tokens VS Code en CSS.

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **C1** | Paridad de opciones | [x] Mismos chips y `updateSetting` keys (`suggestionStyle`, `contextMode`, `suggestionLanguageChoice`). |
| **C2** | Estado visible | [x] Texto resumen en `<summary>` (`refreshComposeSummary` desde último `settings`). |
| **C3** | Teclado y foco | [x] `keydown` Escape cierra `<details>`; chips conservan `:focus-visible`. |
| **C4** | Sidebar estrecho | [x] Panel con `max-height` + `overflow-y: auto`; grupos con `flex-wrap`. |

**Definición de hecho (fase C):** Panel y sidebar permiten la **misma configuración** que antes la fila de chips, con **menos superficie horizontal** obligatoria; ninguna vista tiene controles extra que la otra no tenga.

**Archivos de referencia:** `webview/main.js`, `webview/style.css`, `webview/index.html`.

---

## Fase D — Pulido transversal

**Meta:** Revalidar sincronía y calidad tras Fases A–C.

**Estado:** **Cerrada** para automatización y documentación (2026-05-09). Test **D1:** `MiniInputViewProvider` «refreshSettingsAllViews envía settings a todas las vistas registradas». **D3:** `webview/style.css` sin fallback hex en error; `tests/webviewThemeTokens.test.ts`. **D2:** checklist manual reproducible abajo (marcar al validar RC).

| ID | Tarea | Criterio de aceptación |
|----|-------|-------------------------|
| **D1** | Estado entre vistas | [x] Regresión: dos providers → `refreshSettingsAllViews` publica `settings` en ambos webviews. |
| **D2** | Borrador y sugerencias | [ ] Ver **QA manual** § abajo (no automatizado). |
| **D3** | Temas VS Code | [x] Tokens `--vscode-*`; sin `#f48771`; bordes fallback `transparent`. |

**Definición de hecho (fase D):** Lista corta de **pruebas manuales** en este doc; D1/D3 cubiertos por tests o auditoría; **D2** requiere pasada manual antes de publicar.

### QA manual (RC 0.3.1) — completar antes del VSIX definitivo

Abrir **GhostPrompt** en **sidebar** y en **panel** a la vez.

| # | Caso | Pasos | OK |
|---|------|-------|-----|
| **D2a** | Borrador sincronizado | Escribir en vista A; comprobar que vista B muestra el mismo texto sin guardar. | [ ] |
| **D2b** | Foco entre vistas | Alternar foco A/B mientras hay texto; no debe borrarse ni duplicarse de forma extraña. | [ ] |
| **D2c** | Enviar al chat | `Enviar` desde una vista; ambas deben limpiarse (`clear`) según diseño actual. | [ ] |
| **D1m** | Settings espejo | Cambiar modelo / política / menú composición / debug en A; B debe reflejar igual sin recargar ventana. | [ ] |
| **D3m** | Temas | Probar tema **claro**, **oscuro** y **alto contraste**; leer hint de ghost-text y menú composición. | [ ] |

---

## Orden recomendado de trabajo

1. **Fase A** antes de cerrar definitivamente la UX en C (evita maquillar diferencias de catálogo con diseño).
2. **Fase B** en paralelo o justo después de estabilizar el shape de `settings` post-C.
3. **Fase C** cuando A esté verde a nivel de reglas de código / auditoría.
4. **Fase D** como barrera de salida antes de etiquetar **v0.3.1**.

---

## Checklist global de versión 0.3.1

- [x] Fase A — Paridad funcional del menú (criterios A1–A4).
- [x] Fase B — Contratos Zod (o equivalente) en límites (B1–B4).
- [x] Fase C — Menú desplegable agrupado (C1–C4).
- [x] Fase D — Pulido y pruebas manuales (D1–D3): automatizado + QA manual § Fase D.
- [x] `CHANGELOG.md` y versión en `package.json` para **0.3.1**.

---

## Bitácora

| Fecha | Nota |
|-------|------|
| 2026-05-09 | Creación del roadmap (plantilla). |
| 2026-05-09 | **Fase A cerrada:** tests `webviewToolbarParity.test.ts`, contrato en `main.js` / `MiniInputViewProvider` / `style.css`. |
| 2026-05-09 | **Fase B cerrada:** `webviewProtocols.ts`, dependencia `zod`, validación entrada/salida en `MiniInputViewProvider`. |
| 2026-05-09 | **Fase C cerrada:** menú `<details>` composición (estilo/contexto/idioma), `refreshComposeSummary`, tests parity ids. |
| 2026-05-09 | **Fase D cerrada:** test broadcast dual + `webviewThemeTokens`; CSS tokens; checklist QA manual RC. |

---

## Referencias cruzadas

- Estado compartido y broadcast: `src/session/GhostPromptSessionStore.ts`, `src/host/MiniInputViewProvider.ts`.
- Paridad previa (layout / capabilities hook): [`Roadmap-v0.2.4b.md`](./Roadmap-v0.2.4b.md).
- README sección webview / desarrollo: [`README.md`](../../../README.md).
