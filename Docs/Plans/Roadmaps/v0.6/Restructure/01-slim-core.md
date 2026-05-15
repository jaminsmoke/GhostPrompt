# Roadmap v0.6 Restructure — Adelgazar `core/`

> **Objetivo:** Eliminar de `core/` todo lo que el modelo LLM hace mejor por sí solo, reduciendo código innecesario y simplificando los engines.
> **Contexto:** Tras completar las fases A–I de la auditoría estructural (`Docs/Issues/v0.5.5/0.6.0/`), se detectó que `core/language/`, `core/prompt/normalize.ts` y partes de `core/prompt/instruction.ts` añaden complejidad sin valor real — el modelo puede inferir idioma, no repetir texto, y seguir instrucciones de estilo directamente.
> **Fecha de creación:** 2026-05-15

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado

---

## Fases

### R1 — Eliminar `core/language/` (detección de idioma por keywords)

> **Motivo:** Los 3 engines (copilot, ollama, opencode) NO usan `detectSuggestionLanguageFromInput` ni `resolveSuggestionLanguage`. El modelo detecta el idioma del texto de entrada por contexto. La detección heurística por keywords es código muerto en producción.

#### R1.1 — Eliminar carpeta `core/language/`
- [x] Eliminar `src/core/language/index.ts`
- [x] Eliminar `src/core/language/` (quedará vacío)

**Criterio de hecho:** La carpeta no existe.

#### R1.2 — Limpiar barrel `core/index.ts`
- [x] Eliminar `export * from './language';`

**Criterio de hecho:** `core/index.ts` no referencia `./language`.

#### R1.3 — Limpiar tests que referencian language detection
- [x] `src/engines/copilot/CopilotCompletion.test.ts` — eliminar imports y tests de `detectSuggestionLanguageFromInput`, `resolveSuggestionLanguage`
- [x] `src/ui/provider/MiniInputViewProvider.test.ts` — eliminar mock de `resolveSuggestionLanguage`

**Criterio de hecho:** Ningún test importa de `core/language`.

#### R1.4 — Verificar regresión
- [x] `npm run check` pasa
- [x] `npm run test` — 51 files, 282 tests en verde

**Criterio de hecho:** 0 errores, todos los tests pasan.

---

### R2 — Eliminar `core/prompt/normalize.ts` (post-proceso defensivo)

> **Motivo:** La normalización defensiva (strip duplicated prefix, spurious leading space, suffix continuation) añade 149 líneas de lógica heurística que los modelos modernos ya manejan correctamente con un buen prompt. Simplificar los engines para usar el texto raw del modelo.

#### R2.1 — Eliminar `normalize.ts` y sus tests
- [x] Eliminar `src/core/prompt/normalize.ts`
- [x] Eliminar `src/core/prompt/instructionNormalizeContract.test.ts`
- [x] Eliminar `src/core/prompt/completionInstruction.test.ts`

**Criterio de hecho:** Los archivos no existen.

#### R2.2 — Actualizar barrel `core/prompt/index.ts`
- [x] Eliminar `export * from './normalize';`
- [x] Mantener solo `export * from './instruction';`

**Criterio de hecho:** El barrel solo exporta `instruction.ts`.

#### R2.3 — Actualizar `engines/copilot/copilotLmEngine.ts`
- [x] Eliminar import de `normalizeSuggestion`
- [x] Usar texto raw del modelo directamente (trim básico inline si hace falta)

**Criterio de hecho:** El engine no importa de `core/prompt/normalize`.

#### R2.4 — Actualizar `engines/ollama/ollamaLmEngine.ts`
- [x] Eliminar import de `normalizeSuggestion`
- [x] Usar texto raw del modelo directamente

**Criterio de hecho:** El engine no importa de `core/prompt/normalize`.

#### R2.5 — Actualizar `engines/opencode/opencodeLmEngine.ts`
- [x] Eliminar import de `normalizeSuggestion`
- [x] Usar texto raw del modelo directamente

**Criterio de hecho:** El engine no importa de `core/prompt/normalize`.

#### R2.6 — Actualizar tests de engines
- [x] `src/engines/copilot/CopilotCompletion.test.ts` — eliminar tests de `normalizeSuggestion`
- [x] Verificar que los tests de engines pasan sin normalize

**Criterio de hecho:** Tests de engines pasan.

#### R2.7 — Verificar regresión
- [x] `npm run check` pasa
- [x] `npm run test` — 49 files, 274 tests en verde

---

### R3 — Simplificar `core/prompt/instruction.ts` (construcción del prompt)

> **Motivo:** `buildCompletionInstruction` genera un prompt complejo con style directives, guías de espaciado, y `COMPLETION_PARTIAL_LABEL`. El modelo entiende instrucciones simples. Reducir a una función mínima.

#### R3.1 — Decidir enfoque
- [x] Opción elegida: Simplificar `instruction.ts` a instrucción genérica mínima (12 líneas vs 50)
- [x] Eliminar `COMPLETION_PARTIAL_LABEL`, `suggestionStyleDirective`, parámetros `style` y `_context`

**Criterio de hecho:** Decisión registrada.

#### R3.2 — Ejecutar decisión
- [x] Reescribir `instruction.ts` a función simple de 1 parámetro (`userText`)
- [x] Actualizar los 3 engines (copilot, ollama, opencode) para llamar sin `style`/`context`
- [x] Prefijar `style` y `context` como `_style`/`_context` en destructuring (TS no-unused)
- [x] Actualizar tests: eliminar tests de STYLE_*, styleDirective, language resolution

**Criterio de hecho:** Los engines usan el nuevo enfoque de prompt.

#### R3.3 — Verificar regresión
- [x] `npm run typecheck` pasa
- [x] `npm run test` — 54 files, 297 tests en verde

---

### R4 — Evaluar `core/presentation/loading.ts`

> **Motivo:** Las fases de loading (`copilot`, `opencode-connecting`, `ollama-generating`, etc.) son textos de UI que podrían vivir en los propios engines o en un módulo de UI, no en el dominio core.

#### R4.1 — Auditar uso de `SuggestionLoadingPhase`
- [ ] Identificar todos los consumidores de `SuggestionLoadingPhase` y `suggestionLoadingStatusText`
- [ ] Determinar si puede moverse a engines o eliminarse

**Criterio de hecho:** Mapa de dependencias documentado.

#### R4.2 — Ejecutar (si procede)
- [ ] Mover o eliminar según auditoría R4.1

**Criterio de hecho:** `core/presentation/` simplificado o eliminado.

---

### R5 — Eliminar language types de `core/types.ts`

> **Motivo:** Si se elimina la detección de idioma y el sistema de language settings, los types `SuggestionLanguageMode` y `SupportedSuggestionLanguage` quedan como dead code en `core/types.ts`.

#### R5.1 — Eliminar types de language
- [ ] Eliminar `SuggestionLanguageMode` de `src/core/types.ts`
- [ ] Eliminar `SupportedSuggestionLanguage` de `src/core/types.ts`

**Criterio de hecho:** `core/types.ts` no exporta types de language.

#### R5.2 — Actualizar `SuggestionContext` en `core/types.ts`
- [ ] Eliminar campo `outputLanguage?: SupportedSuggestionLanguage` de la interfaz

**Criterio de hecho:** `SuggestionContext` no tiene campo de language.

#### R5.3 — Actualizar imports en archivos que usaban estos types
- [ ] `src/api/getters/workspaceGetters.ts` — eliminar imports de language types
- [ ] `src/api/settings/settingsPostMessage.ts` — eliminar imports de language types
- [ ] `src/engines/` — eliminar imports de language types si existen

**Criterio de hecho:** Ningún archivo importa language types de `core/types`.

#### R5.4 — Verificar regresión
- [ ] `npm run check` pasa

**Criterio de hecho:** 0 errores de TypeScript.

---

### R6 — Eliminar language getters de `api/getters/workspaceGetters.ts`

> **Motivo:** Los getters de language config (`getGhostPromptSuggestionLanguageMode`, `getGhostPromptSuggestionLanguage`, `getGhostPromptSuggestionLanguageChoice`) leen settings que van a ser eliminadas. No tienen consumidores fuera del sistema de settings.

#### R6.1 — Eliminar funciones getter
- [ ] Eliminar `getGhostPromptSuggestionLanguageMode()` de `workspaceGetters.ts`
- [ ] Eliminar `getGhostPromptSuggestionLanguage()` de `workspaceGetters.ts`
- [ ] Eliminar `getGhostPromptSuggestionLanguageChoice()` de `workspaceGetters.ts`

**Criterio de hecho:** `workspaceGetters.ts` no exporta funciones de language.

#### R6.2 — Limpiar barrel `api/index.ts`
- [ ] Eliminar `getGhostPromptSuggestionLanguageMode` del barrel
- [ ] Eliminar `getGhostPromptSuggestionLanguage` del barrel
- [ ] Eliminar `getGhostPromptSuggestionLanguageChoice` del barrel

**Criterio de hecho:** `api/index.ts` no exporta language getters.

#### R6.3 — Limpiar `MiniInputViewProvider.ts`
- [ ] Eliminar import de `getGhostPromptSuggestionLanguageChoice`
- [ ] Eliminar `getSuggestionLanguageChoice` del objeto `ghostPromptSuggestDeps()`

**Criterio de hecho:** `MiniInputViewProvider.ts` no referencia language getters.

#### R6.4 — Actualizar tests
- [ ] `src/ui/provider/MiniInputViewProvider.test.ts` — eliminar mocks de language getters
- [ ] `src/api/contracts/webviewMessageSchemas.test.ts` — eliminar refs a language si aplica

**Criterio de hecho:** Tests pasan sin language mocks.

#### R6.5 — Verificar regresión
- [ ] `npm run check` pasa
- [ ] `npm run test` — todos los tests en verde

---

### R7 — Eliminar language del sistema de settings (API layer)

> **Motivo:** El sistema de settings maneja `suggestionLanguageChoice` como setting editable desde el webview. Al eliminar el sistema de language, este setting y su handler deben desaparecer.

#### R7.1 — Eliminar handler de `suggestionLanguageChoice` en `api/settings/applyWebviewUpdate.ts`
- [ ] Eliminar el bloque `if (message.key === 'suggestionLanguageChoice')`
- [ ] Eliminar imports de language types si quedan

**Criterio de hecho:** `applyWebviewUpdate.ts` no maneja `suggestionLanguageChoice`.

#### R7.2 — Eliminar `suggestionLanguageChoice` del envelope de settings
- [ ] Eliminar `suggestionLanguageChoice: getters.getSuggestionLanguageChoice()` de `api/settings/settingsPostMessage.ts`
- [ ] Eliminar `getSuggestionLanguageChoice` del tipo `GhostPromptSettingsGetters`

**Criterio de hecho:** El envelope de settings no incluye `suggestionLanguageChoice`.

#### R7.3 — Eliminar schema de `suggestionLanguageChoice` en `api/contracts/webviewMessageSchemas.ts`
- [ ] Eliminar `suggestionLanguageChoice: z.enum(['auto', 'es', 'en'])` del settings schema
- [ ] Eliminar el case de `updateSetting` para `suggestionLanguageChoice` del inbound schema

**Criterio de hecho:** Los schemas Zod no referencian `suggestionLanguageChoice`.

#### R7.4 — Actualizar tests de schemas y settings
- [ ] `src/api/contracts/webviewMessageSchemas.test.ts` — eliminar tests de `suggestionLanguageChoice`
- [ ] `src/api/protocols/webviewProtocols.test.ts` — eliminar refs a `suggestionLanguageChoice`
- [ ] `src/api/settings/applyWebviewUpdate.test.ts` — eliminar tests de `suggestionLanguageChoice`

**Criterio de hecho:** Tests de schemas y settings pasan sin language.

#### R7.5 — Verificar regresión
- [ ] `npm run check` pasa
- [ ] `npm run test` — todos los tests en verde

---

### R8 — Eliminar language de la UI webview (React components)

> **Motivo:** El webview muestra un chip de idioma (Auto/ES/EN) en el toolbar que permite cambiar el setting de language. Al eliminar el sistema, este chip y toda su lógica deben desaparecer.

#### R8.1 — Eliminar language del webview types
- [ ] Eliminar `suggestionLanguageChoice: 'auto' | 'es' | 'en'` de `src/ui/webview/react/types.ts`
- [ ] Eliminar el case `{ type: 'updateSetting'; key: 'suggestionLanguageChoice' }` del union type de mensajes

**Criterio de hecho:** `webview/react/types.ts` no tiene types de language.

#### R8.2 — Eliminar language schema del webview validators
- [ ] Eliminar `suggestionLanguageChoice: z.enum(['auto', 'es', 'en'])` de `src/ui/webview/react/validators/webviewMessageSchemas.ts`

**Criterio de hecho:** El validator del webview no incluye `suggestionLanguageChoice`.

#### R8.3 — Eliminar language state del hook `useGhostPrompt.ts`
- [ ] Eliminar `useState` de `suggestionLanguageChoice`
- [ ] Eliminar `setSuggestionLanguageChoice` del handler de settings message
- [ ] Eliminar `suggestionLanguageChoice` del objeto retornado por el hook
- [ ] Eliminar `onToggle` handler para `suggestionLanguageChoice`

**Criterio de hecho:** `useGhostPrompt.ts` no gestiona language state.

#### R8.4 — Eliminar language chip de `GhostToolbar.tsx`
- [ ] Eliminar el bloque de `suggestionLanguageChoice` dentro del `composicion-chip`
- [ ] Eliminar `suggestionLanguageChoice` de las props del componente
- [ ] Actualizar el label del chip de composición (ya no mostrará idioma)

**Criterio de hecho:** `GhostToolbar.tsx` no renderiza opciones de language.

#### R8.5 — Actualizar tests del webview
- [ ] `src/ui/webview/react/hooks/useGhostPrompt.test.ts` — eliminar refs a `suggestionLanguageChoice`
- [ ] `src/ui/webview/webviewToolbarParity.test.ts` — eliminar `suggestionLanguageChoice` de la lista de settings
- [ ] `tests/webview/useGhostPrompt.test.ts` — eliminar refs a language

**Criterio de hecho:** Tests del webview pasan sin language.

#### R8.6 — Rebuild del webview
- [ ] `npm run build:webview` — build exitoso
- [ ] Verificar que el bundle no contiene refs a language

**Criterio de hecho:** Webview build pasa sin errores.

---

### R9 — Eliminar config keys de language de `package.json`

> **Motivo:** Las keys `suggestionLanguage` y `suggestionLanguageMode` en `package.json` definen settings de VS Code que ya no tienen código que las lea ni las use.

#### R9.1 — Eliminar config keys
- [ ] Eliminar `ghostPrompt.suggestionLanguageMode` de `package.json`
- [ ] Eliminar `ghostPrompt.suggestionLanguage` de `package.json`

**Criterio de hecho:** `package.json` no tiene config keys de language.

#### R9.2 — Validar JSON
- [ ] Verificar que `package.json` es JSON válido

**Criterio de hecho:** `node -e "JSON.parse(...)"` pasa.

---

### R10 — Verificación final y documentación

> **Motivo:** Asegurar que toda la eliminación del sistema de language y la simplificación de `core/` está completa y funcional.

#### R10.1 — Verificación completa
- [ ] `npm run check` — 0 errores
- [ ] `npm run test` — todos los tests pasan
- [ ] `npm run build:webview` — build exitoso

**Criterio de hecho:** Todos los checks pasan.

#### R10.2 — Verificar que no quedan refs a language
- [ ] `grep -r "suggestionLanguage" src/` — 0 resultados (excepto comments)
- [ ] `grep -r "detectSuggestionLanguage" src/` — 0 resultados
- [ ] `grep -r "resolveSuggestionLanguage" src/` — 0 resultados
- [ ] `grep -r "normalizeSuggestion" src/` — 0 resultados

**Criterio de hecho:** No quedan referencias de código activo a los módulos eliminados.

#### R10.3 — Documentar cambios
- [ ] Actualizar `src/core/README.md` — eliminar refs a language y normalize
- [ ] Actualizar `src/api/README.md` — eliminar refs a language settings
- [ ] Documentar líneas eliminadas vs añadidas

**Criterio de hecho:** READMEs reflejan la estructura actual.

---

## Estado

| Fase | Descripción | Estado |
| ---- | ----------- | ------ |
| R1 | Eliminar `core/language/` | 🟢 Completado |
| R2 | Eliminar `core/prompt/normalize.ts` | 🟢 Completado |
| R3 | Simplificar `core/prompt/instruction.ts` | 🟢 Completado |
| R4 | Evaluar `core/presentation/loading.ts` | ⚪ No iniciado |
| R5 | Eliminar language types de `core/types.ts` | ⚪ No iniciado |
| R6 | Eliminar language getters de `api/` | ⚪ No iniciado |
| R7 | Eliminar language del sistema de settings | ⚪ No iniciado |
| R8 | Eliminar language de la UI webview | ⚪ No iniciado |
| R9 | Eliminar config keys de `package.json` | ⚪ No iniciado |
| R10 | Verificación final y documentación | ⚪ No iniciado |

---

## Bitácora

| Fecha | Fase | Nota |
| ----- | ---- | ---- |
| 2026-05-15 | — | Roadmap creado tras completar fases A–I de auditoría estructural |
| 2026-05-15 | R1 | **R1 completa:** `core/language/` eliminado. Barrel limpio. Tests actualizados (-5 tests de language). 282 tests en verde (51 files). |
| 2026-05-15 | R2 | **R2 completa:** `normalize.ts` eliminado (149 líneas). 3 engines actualizados con trim inline. Tests de normalize eliminados. 274 tests en verde (49 files). |
| 2026-05-15 | R3 | **R3 completa:** `instruction.ts` simplificado de 50 a 12 líneas. Eliminados `COMPLETION_PARTIAL_LABEL`, `suggestionStyleDirective`, params `style`/`context`. 297 tests en verde (54 files). |

---

## Referencias

- Auditoría estructural completada: [`Docs/Issues/v0.5.5/0.6.0/`](../../../Issues/v0.5.5/0.6.0/README.md)
- Estado actual de `core/`: [`src/core/`](../../../../src/core/)
- Roadmap v0.6 principal: [`Docs/Plans/Roadmaps/v0.6/README.md`](../README.md)
