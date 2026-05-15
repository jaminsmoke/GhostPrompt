# v0.6 — Reorganización del dominio (core · system · engines · destinations · api)

## 1. Objetivo

Definir y ejecutar una reorganización de **owners** (carpetas, módulos y README) para que:

- **core** = sistema de **suggestions** y **valor del programa**: flujo, estado, contratos compartidos con engines, routing de fuente, y el contrato mínimo de “presentación del ciclo” (p. ej. fases de carga). No infra genérica ni listados de UI que no formen parte del hot path del suggest.
- **system** = tareas transversales de sistema: logging, debug, notificaciones host, persistencia genérica, etc.
- **engines** = proveedores LM (Copilot, OpenCode, Ollama): llamada al modelo, catálogos por proveedor, detalles de streaming propios del motor.
- **destinations** = superficies donde el usuario **consume** el resultado: ghost inline, envío del prompt a un chat, reenvío a VSOpenCodeX, etc. (Aclarar en documentación si “destination” incluye solo envío o también la superficie del ghost.)
- **api** = pegamento VS Code ↔ webview ↔ comandos: protocolos, getters, handlers, settings hacia la webview; **sin** acumular lógica de negocio pesada de suggestion.

**Principio de producto (v0.6):** evitar que heurísticas globales (`instruction`, `normalize`) compitan con el modelo; revisar también la **UI** como origen de separación visual del ghost (string `suggestion`, layout).

**Progreso (2026-05-14):** Fases **A–D** y **F** (CI + release **0.6.0** en repo). **E** parcial (quedan ítems de producto/UI y checklist manual). **Fase G** (reorganización física `core/`) **avanzada**: `routing/`, `contracts/`, `suggest/`, `prompt/`, `presentation/`, `streaming/`; opcional futuro: `session/` → `state/`, etc. (ver §8 backlog).

---

## 2. Definiciones (para README y `Docs/Owners.md`)

| Capa             | Rol                                 | Ejemplos                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| **core**         | Dominio suggestion                  | Pipeline, sesión/cancelación, contratos de completion, routing de fuente, textos de fase del ciclo |
| **system**       | Infra no específica del valor       | Logs, canal debug, almacenamiento genérico                                                         |
| **engines**      | Quién llama al modelo               | `copilotLmEngine`, catálogos por proveedor                                                         |
| **destinations** | Dónde se muestra / a dónde se envía | Sidebar/panel ghost, forward VSOpenCodeX, envío a Copilot Chat                                     |
| **api**          | Adaptador VS Code                   | `inboundHandlers`, `settingsPostMessage`, Zod/protocolos                                           |

---

## 3. Estado actual (inventario breve)

- `src/core/index.ts` — barrel del **dominio suggestion** solamente: tipos, bootstrap de proyecto (`memory/projectBootstrapContext` vía reexports), **`prompt/`**, **`presentation/`**, **`streaming/`**, **`language/`**, **`state/`**, **`routing/sources`**, **`suggest/`**. **Sin** reexports a `engines/`, **sin** governor (legacy en `system/policies/`).
- **`api/` ya no importa el barrel `core/index.ts`**: `settingsPostMessage` usa `core/routing/sources`, `core/types` y catálogos/listas desde `engines/...`; `workspaceGetters` importa tipos desde `core/types`.
- `listMergedSuggestionModels` (`engines/catalog/mergedModelCatalog.ts`) lo consume **`api/settings/settingsPostMessage.ts`** (lista de modelos para chips/UI), **no** el pipeline principal de `suggest`.
- `SuggestionRequestGovernor` (**legacy**): código en **`system/policies/`** + tests; **no** en `runSuggest`; **no** reexportado desde `core/index.ts`.
- `core/memory/**` incluye **`projectBootstrapContext.ts`** (card README/package) acoplado a persist/ingest.
- UI: `PromptInput` compone `text` + `suggestion`; un espacio inicial en el string se ve como hueco (no es solo “culpa del core”).

---

## 4. Estructura de `src/core/`: realidad (v0.6) vs objetivo de carpetas

> **v0.6** entregó **owners y límites** (barrel, imports, `engines/catalog`, pipeline, docs). **Fase G** ha ido alineando el árbol con el §4.2 (`suggest/`, `routing/`, `contracts/`, `prompt/`, `presentation/`, `streaming/`, `state/`, `language/`). Eliminadas carpetas vacías y movidos `context/` + `governor/` fuera de `core/` (`memory/projectBootstrapContext`, `system/policies/SuggestionRequestGovernor`).

### 4.1 Árbol actual (post Fase G parcial, 2026-05-14)

```
core/
  index.ts, types.ts
  contracts/
    completion.ts
  prompt/
    instruction.ts, normalize.ts, index.ts
  presentation/
    loading.ts, index.ts
  streaming/
    collect.ts, index.ts
  language/
    index.ts
  routing/
    sources.ts
  suggest/
    runSuggest.ts, index.ts
  state/
    GhostPromptSessionStore.ts
  memory/
    projectBootstrapContext.ts
    … (persist, ingest, store, …)
```

### 4.2 Objetivo de carpetas (referencia §4.2 — casi alineado; detalles opcionales)

Propuesta de **refactor físico** futuro (renombrar/mover módulos sin cambiar comportamiento):

```
core/
  README.md
  suggest/                  # Flujo principal del suggest
    runSuggest.ts           # evolución de suggestPipeline.ts
    index.ts
  state/
    GhostPromptSessionStore.ts
  contracts/
    completion.ts           # evolución desde types.ts (resultados, opciones de request)
    index.ts
  routing/
    sources.ts
  presentation/
    loading.ts
  prompt/
    instruction.ts
    normalize.ts
  streaming/
    collect.ts              # evolución de streaming.ts
  language/                 # opcional
    resolve.ts
  index.ts
```

### Movimientos previstos fuera de `core`

| Origen actual                                                                            | Destino candidato                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ~~`core/catalog/mergedModelCatalog.ts`~~ → `engines/catalog/mergedModelCatalog.ts`       | **Hecho (v0.6 inicio)**                                                             |
| `core/memory/**`                                                                         | `system/storage/` o feature aparte; no núcleo del suggest si se retira del producto |
| ~~`core/context/projectBootstrapContext.ts`~~ → `core/memory/projectBootstrapContext.ts` | **Hecho (Fase G, 2026-05-14)**                                                      |
| ~~`core/governor/**`~~ → `system/policies/SuggestionRequestGovernor.ts`                  | **Hecho (Fase G, 2026-05-14)** — legacy; fuera del barrel `core/index.ts`           |

---

## 5. Fases de trabajo

### Fase A — Documentación y contrato (poco o ningún move de código)

- [x] Actualizar `Docs/Owners.md` con matriz core / system / engines / destinations / api.
- [x] README en `src/core/` con reglas de dependencia y enlace a este roadmap.
- [x] Diagrama Mermaid: webview → api → core.suggest → engines → api → webview.

### Fase B — Aplanar el barrel `src/core/index.ts`

- [x] Inventariar reexports del barrel (tabla en este doc).
- [x] Inventariar consumidores de cada símbolo (grep / ajustar imports). **Hecho:** sin imports `from '.../core'` en `src/`; tests sin barrel `../src/core` salvo rutas explícitas a submódulos.
- [x] Objetivo: barrel solo reexporta el dominio suggestion; quitar reexports accidentales. **Hecho (2026-05-14):** eliminados del barrel `core/index.ts` el catálogo Copilot (`modelCatalog`), `requestCompletion`, `CompletionProvider` + getters del registry, `listOpencodeSuggestionModels`, `listOllamaSuggestionModels`.

**Consumidores (2026-05-14)** — imports directos al barrel `core/index.ts`:

| Ámbito   | Archivos           | Notas                                                                                                                                                |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`   | _ninguno_          | `api/settings/settingsPostMessage.ts` → `core/routing/sources`, `core/types`, `engines/*/catalog`; `api/getters/workspaceGetters.ts` → `core/types`. |
| `tests/` | _ninguno_ (barrel) | `CopilotCompletion.test.ts` importa desde `engines/copilot/...` y submódulos `core/`.                                                                |

**Barrel `core/index.ts` (2026-05-14)** — reexports **eliminados** (usar `engines/`):

| Eliminado                                                                                                          | Importar desde                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `export *` `modelCatalog`                                                                                          | `engines/copilot/catalog/modelCatalog`                           |
| `requestCompletion`                                                                                                | `engines/copilot/copilotLmEngine` (`requestCopilotLmCompletion`) |
| `CompletionProvider`, `getActiveCompletionProvider`, `getCompletionProviderForSource`, `getCompletionProviderKind` | `engines/engineRegistry`                                         |
| `listOpencodeSuggestionModels`                                                                                     | `engines/opencode/catalog/opencodeModelCatalog`                  |
| `listOllamaSuggestionModels`                                                                                       | `engines/ollama/catalog/ollamaModelCatalog`                      |

**Permanece en el barrel:**

| Export                                                                                                                        | Origen                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `export *` `./types`, `./prompt`, `./language`, `./streaming`                                                                 | core                                           |
| `suggestionLoadingStatusText`, `SuggestionLoadingPhase`                                                                       | `./presentation`                               |
| Helpers bootstrap proyecto                                                                                                    | `./memory/projectBootstrapContext`             |
| `getCompletionUiKind`, `getEnabledCompletionSources`, `looksLike*`, `resolveCompletionSourceForRequest`, `CompletionSourceId` | `./routing/sources`                            |
| `GhostPromptSessionStore`, `runGhostPromptSuggestPipeline`, `handleGhostPromptSuggest`                                        | `./state/GhostPromptSessionStore`, `./suggest` |

> `SuggestionRequestGovernor`: ver `system/policies/`; **no** forma parte del barrel `index.ts` (Fase D).

### Fase C — Catálogo merged fuera de core

- [x] Nuevo módulo bajo `engines/` (decisión explícita).
- [x] Actualizar `settingsPostMessage` y tests asociados.

### Fase D — Governor y memoria

- [x] Governor: **fuera del hot path** y **fuera del barrel** público `core/index.ts` (módulo + `SuggestionRequestGovernor.test.ts` conservados).
- [x] Memoria de proyecto: **permanece en `core/memory/`** en v0.6 (decisión §8); traslado a `system/` → backlog v0.7+.

### Fase E — Prompt, normalize y UI

- [x] **Estado vigente documentado:** `instruction` compacta (sin bloque “Relevant project context” en el prompt); contrato cubierto por `tests/completionInstruction.test.ts`.
- [ ] Política por motor / menos heurística global donde duela → backlog explícito (no bloquea v0.6 owners).
- [ ] Checklist UI manual: `suggestion` + whitespace, Tab/accept, Sidebar + Panel (broadcast).

### Fase F — Verificación

- [x] `npm run check` y suite de tests.
- [ ] **Ejecución:** prueba manual en VS Code (checklist en **Fase F** más abajo).
- [x] `CHANGELOG.md` versión **0.6.0** + `package.json` / `package-lock.json`.

#### Checklist manual (Sidebar + Panel)

Ejecutar con la extensión compilada (`npm run compile` o F5 _Run Extension_). Marcar localmente al validar.

1. **Carga:** abrir vista GhostPrompt en **Sidebar** y en **Panel** inferior; ambas cargan sin error de bundle (sin `GhostPrompt React webview bundle missing`).
2. **Settings:** chips (motor, modelo, estilo, idioma, etc.) visibles y coherentes en **ambas** vistas.
3. **Suggest:** escribir ≥3 caracteres no solo espacios; aparece fase `loading` y luego ghost `suggestion` o mensaje vacío coherente.
4. **Too-short:** texto solo espacios o menos de 3 caracteres útiles → sin llamada ruidosa; UI recupera en la siguiente entrada válida.
5. **Broadcast:** con ambas vistas abiertas, comprobar que `suggestion` / `empty` / borrador se reflejan en la otra vista cuando aplique.
6. **Tab / accept:** con sugerencia visible, Tab inserta el ghost sin duplicar basura obvia.
7. **Whitespace en ghost:** ojo visual a prefijos espacio en `suggestion` (tema Fase E — anotar si regresa).

### Fase G — Reestructuración física `core/` (principalmente hecha)

Alinear el **árbol de carpetas** con el layout del §4.2 (`suggest/`, `routing/`, `contracts/`, …).

- [x] **`sources.ts` → `core/routing/sources.ts`** (imports en `api/`, `engines/`, `core/suggest`, tests).
- [x] Contratos / tipos de completion → `core/contracts/completion.ts` (barrel `types.ts`).
- [x] Pipeline suggest → `core/suggest/` (`runSuggest.ts`, barrel `suggest/index.ts`).
- [x] Prompt (`instruction`, `normalize`) → `core/prompt/` (barrel `prompt/index.ts`; motores importan `core/prompt/...`).
- [x] Streaming → `core/streaming/` (`collect.ts`, barrel `streaming/index.ts`).
- [x] Fases de carga UI → `core/presentation/loading.ts` (barrel `presentation/index.ts`).
- [x] `Owners.md` / diagramas que aún citen rutas antiguas (actualizado a `suggest/`, `contracts/`; históricos v0.5.x sin tocar).

---

## 6. Criterios de aceptación (v0.6)

- Un desarrollador nuevo sitúa un cambio en **menos de cinco minutos**: suggest vs engine vs system vs api.
- El hot path `suggest` **no** importa catálogo merged, memoria de proyecto ni governor legacy.
- README y Owners reflejan la taxonomía y enlazan a esta carpeta `v0.6`.
- La **estructura de carpetas** de `core/` incorpora `routing/`, `contracts/`, `suggest/`, `prompt/`, `presentation/`, `streaming/`, `state/` y `language/`; el §4.2 puede seguir evolucionando (p. ej. más bajo `presentation/`).

## 7. Riesgos

- **Churn** de imports y tests sin ganancia si solo se renombran carpetas.
- **Duplicar** `instruction`/`normalize` en tres engines sin plan explícito genera deuda nueva.

---

## 8. Decisiones (v0.6) y backlog

| Tema                            | Decisión v0.6                                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memoria de proyecto             | **Se mantiene** en `src/core/memory/`; activación en `extension.ts`. Posible mudanza a `system/` en versión posterior.                                                                                                                                     |
| `normalize` / `instruction`     | **Compartidos** en `src/core/prompt/`; adelgazamiento o variantes por motor → backlog (Fase E).                                                                                                                                                            |
| «Destinations» en documentación | Incluye **superficies de consumo** del resultado: ghost inline (webview), envío a chat (`destinations/copilotChat/`), forward a VSOpenCodeX (`destinations/vsOpenCodeX/`). La **caja de texto** del webview es presentación, no un “destination” de envío. |
| Governor                        | **Legacy** en `src/system/policies/SuggestionRequestGovernor.ts`: no participa en `runSuggest`; no forma parte del API del barrel `core/index.ts`.                                                                                                         |

### Pendiente de revisión (no bloquea owners v0.6)

- [ ] Retirar por completo el módulo governor y tests si el producto confirma que no habrá reactivación.
- [x] **Opcional:** `session/` → `state/` (`GhostPromptSessionStore`); `language.ts` → `language/index.ts`.
- [ ] **Fase G (opcional):** más módulos bajo `presentation/` si crece la UI host.

---

## 9. Referencias en código

- `src/core/index.ts` — barrel del dominio suggestion (sin catálogos LM ni registry; ver `engines/`).
- `src/engines/catalog/mergedModelCatalog.ts` — merge multi-motor para settings/UI.
- **`src/core/memory/projectBootstrapContext.ts`** — card README/package (antes `core/context/`); acoplado a `memory/persist` e ingest.
- **`src/system/policies/SuggestionRequestGovernor.ts`** — governor legacy (antes `core/governor/`); solo tests.
- `src/core/routing/sources.ts` — fuentes habilitadas y `resolveCompletionSourceForRequest`.
- `src/core/suggest/runSuggest.ts` — orquestación del mensaje `suggest`.
- `src/core/prompt/` — `buildCompletionInstruction`, `normalizeSuggestion`.
- `src/core/presentation/loading.ts` — fases de carga y `suggestionLoadingStatusText`.
- `src/core/streaming/collect.ts` — `collectResponseText` (stream LM VS Code).
- `src/core/state/GhostPromptSessionStore.ts` — singleton de estado Sidebar+Panel.
- `src/core/language/index.ts` — `resolveSuggestionLanguage`, `detectSuggestionLanguageFromInput`.
- `src/api/settings/settingsPostMessage.ts` — uso de `listMergedSuggestionModels`.
- `src/ui/webview/react/components/PromptInput.tsx` — render del ghost.
- Roadmaps relacionados v0.5: `Docs/Plans/Roadmaps/v0.5/core_reorg/`, `ui_domain/`.

---

## 10. Historial del documento

| Fecha      | Cambio                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-14 | **Inicio ejecución:** Fase A (Owners, `core/README`, Mermaid) + Fase C (`listMergedSuggestionModels` → `engines/catalog/mergedModelCatalog.ts`).                                               |
| 2026-05-14 | Barrel `core/index.ts` aplanado; §4 real vs objetivo; versión **0.6.0**; decisiones §8.                                                                                                        |
| 2026-05-14 | **Fase G:** `sources.ts` → `core/routing/sources.ts` + imports.                                                                                                                                |
| 2026-05-14 | **Fase G:** `contracts/completion` + `suggest/` (ex `pipeline/`), barrel `types.ts`; docs y tests alineados.                                                                                   |
| 2026-05-14 | **Fase G:** `prompt/` (`instruction`, `normalize`) + imports en `engines/` y tests.                                                                                                            |
| 2026-05-14 | **Fase G:** `presentation/loading` + `streaming/collect` + imports y docs.                                                                                                                     |
| 2026-05-14 | **Fase G:** `state/` (ex `session/`) + `language/`; imports y docs.                                                                                                                            |
| 2026-05-14 | **Fase G:** `suggest/suggestPipeline.ts` → `runSuggest.ts`; eliminadas carpetas vacías `core/catalog/`, `core/pipeline/`, `core/session/`.                                                     |
| 2026-05-14 | **Fase G:** `core/context/` → `memory/projectBootstrapContext.ts`; `core/governor/` → `system/policies/SuggestionRequestGovernor.ts`; carpetas `context/` y `governor/` eliminadas de `core/`. |
