# Roadmap v0.2.4b - GhostPrompt

> **Estado:** Cerrado (Sprints 1–6 completados; release **0.2.5**)  
> **Objetivo:** Unificar la sesion de GhostPrompt entre Sidebar y Panel, eliminar divergencias de estado/UI y reforzar diferencias reales entre estilos de suggestion.

## Objetivo de v0.2.4b

Tratar GhostPrompt como una unica sesion con dos vistas sincronizadas en tiempo real (Activity Bar + Panel), de forma que texto, settings y estado de suggestion funcionen como espejo. En paralelo, consolidar la diferencia funcional entre estilos `breve`, `normal` y `extenso` para que el usuario perciba claramente su efecto.

## Problemas priorizados

1. Las dos vistas comparten parte del estado, pero no se comportan como espejo total (draft/input no sincronizado).
2. Algunas opciones pueden percibirse distintas entre vistas por layout compacto (ej: chip debug menos visible en panel estrecho).
3. La arquitectura mantiene logica repartida entre instancias de webview, aumentando riesgo de divergencias futuras.
4. La diferencia de salida entre estilos existe, pero debe mantenerse y validarse de forma cuantificable para evitar regresiones.

## Metas de producto (v0.2.4b)

- Sidebar y Panel se comportan como dos ventanas de la misma sesion.
- Cualquier cambio de config en una vista se refleja de inmediato en la otra.
- El texto en curso (draft) se comparte en tiempo real entre ambas vistas.
- La diferencia entre `breve`, `normal` y `extenso` es clara y consistente.

## Metas tecnicas (v0.2.4b)

- Introducir store de sesion unico en host (single source of truth).
- Definir protocolo de sincronizacion host↔webviews con eventos tipados y `originViewId`.
- Garantizar render consistente en layouts estrechos sin perder controles criticos.
- Añadir tests de sincronizacion multi-vista y regresion de estilos.

## Plan ejecutable

### Sprint 1 - P0 (Store unico de sesion)

- [x] Definir `GhostPromptSessionState` centralizado en host (`src/GhostPromptSessionStore.ts`):
  - `draftText`, `pendingSuggestion`, `suggestionFlowStatus`, errores de suggestion
  - historial de sesion (`lastAcceptedSuggestion`, `lastSentPrompt`, `recentSentPrompts`)
  - `lastEffectiveSuggestionLanguage`, `lastEffectiveModel`, `activeCaptureId`
- [x] Implementar utilidades base:
  - `getSnapshot()`
  - `patchState()`
  - `subscribe(viewId, listener)`
  - `prepareSuggestionRequest(captureId)` / `disposeActiveSuggestionToken` para un solo request activo entre vistas
- [x] Reemplazar `_sharedState` y `_latestCaptureId` / token por instancia con el store singleton `ghostPromptSessionStore`.

#### Criterios de aceptacion P0

- [x] Ambas vistas leen el mismo snapshot para modelo/idioma efectivo y contexto reciente.
- [x] Un solo `activeCaptureId` y un solo token de cancelacion compartido (no hay estado duplicado por provider para esos campos).

#### Validacion

- [x] `npm run check` verde.
- [x] Tests unitarios en `tests/GhostPromptSessionStore.test.ts`.

### Sprint 2 - P0 (Sincronizacion de draft en tiempo real)

- [x] Añadir evento `draftChanged` desde webview al host (`text` + `originViewId`).
- [x] Inyectar `viewContributionId` en HTML (`{{viewIdScript}}`) para identificar cada webview.
- [x] Propagar con `draftSync` a la otra vista; hidratar al abrir con `draftHydrate` desde `ghostPromptSessionStore.draftText`.
- [x] Flag `applyingRemoteDraft` en cliente para no reemitir ni disparar suggest duplicado al aplicar borrador remoto.
- [x] Tras enviar al chat: `draftText` vacío en store + `clear` broadcast a todas las vistas.

#### Criterios de aceptacion P0

- [x] Escribir en una vista actualiza `draftText` en host y espeja el texto en la otra vista.
- [x] Abrir la segunda vista recibe el borrador actual (`draftHydrate`).
- [x] Sin eco infinito gracias a `originViewId` + flag local.

#### Validacion

- [x] `npm run check` verde.

### Sprint 3 - P1 (Sincronizacion completa de settings y suggestion state)

- [x] Unificar mensajes de settings: `_broadcastSettingsToAllViews` tras cada `updateSetting` (paridad inmediata entre vistas).
- [x] Sincronizar estado de suggestion vía `_broadcastUi` (`broadcast: true`) en webview:
  - loading
  - suggestion activa
  - empty/error
  - idioma efectivo (`languageEffective`)
- [x] Mantener normalizacion en host como unica fuente de verdad para evitar divergencias.

#### Criterios de aceptacion P1

- [x] Cambiar estilo/modelo/idioma/debug en una vista actualiza la otra sin recargar.
- [x] Spinner/estado/modelo activo coinciden en ambas vistas durante una request.

#### Validacion

- [x] `npm run check` verde.

### Sprint 4 - P1 (Paridad UX en layouts distintos)

- [x] Strip de opciones: `flex-wrap` + `width: 100%` (sustituye scroll horizontal); selector de modelo y etiqueta runtime con `min(..., 100%)` para no desbordar.
- [x] Barra inferior: texto de ayuda con salto de linea (`overflow-wrap`) para vistas estrechas; boton Enviar sigue visible al hacer wrap.
- [x] Debug: `aria-label`, `aria-pressed` sincronizado con estado (click optimista + mensaje `settings`).
- [x] `window.__ghostPromptCapabilities` inyectado desde host (`_webviewCapabilitiesPayload()`); hook CSS `gp-cap-compact-toolbar` si `compactToolbar: true` (paridad por defecto objeto vacio).

#### Criterios de aceptacion P1

- [x] Ninguna vista pierde controles por ancho disponible (wrap en lugar de overflow oculto).
- [x] La paridad funcional entre Sidebar y Panel es estable (mismas capacidades por defecto).

#### Validacion

- [x] `npm run check` verde.

### Sprint 5 - P1.5 (Calibracion de estilos y no-regresion)

- [x] Directivas de estilo en `suggestionStyleDirective()` + uso en `buildCompletionInstruction`:
  - `STYLE_CONCISE`: como mucho 4 palabras, sin segunda frase ni listas.
  - `STYLE_BALANCED`: una frase practica (orientacion 8-18 palabras).
  - `STYLE_DETAILED`: 2-3 frases concretas (orientacion 25-60 palabras).
- [x] Tests de regresion en `tests/CopilotCompletion.test.ts` (marcadores `STYLE_*` disjuntos, `requestCompletion` inyecta estilo, `suggestionStyleDirective`).
- [x] Test multi-vista en `tests/GhostPromptSessionStore.test.ts` (dos suscriptores reciben el mismo snapshot en draft, pending suggestion y `prepareSuggestionRequest`).
- [x] Casos de normalizacion cubiertos en tests existentes (`normalizeSuggestion`: palabra incompleta, puntuacion, sin espacios artificiales en palabra partida).

#### Verificacion manual sugerida (normalizacion / modelo real)

- [ ] Completar palabra incompleta al final del borrador (sin espacio inicial en el ghost).
- [ ] Tras `:`, `,`, `.` que el ghost inserte una sola separacion antes de nueva palabra.
- [ ] Sin artefactos tipo palabra cortada con espacio (`apli cacion`).
- [ ] Probar Breve / Normal / Extenso con el mismo prompt y comprobar longitud relativa en sesion real.

#### Criterios de aceptacion P1.5

- [x] Diferencias de estilo acotadas en instruccion y repetibles en tests (`STYLE_*` + reglas de longitud).
- [x] `npm run check` verde con cobertura multi-vista en store.

#### Validacion

- [x] `npm run check` verde.

### Sprint 6 - P2 (Cierre de release 0.2.4b)

- [x] Smoke test guiado con dos vistas (checklist reproducible mas abajo).
- [x] README y CHANGELOG actualizados (sesion unificada); version **`0.2.5`**.
- [x] VSIX local: `npm run vsix` en CI local.

#### Smoke manual (Sidebar + Panel a la vez)

1. Abrir GhostPrompt en **Activity Bar** y en **Panel** (dos webviews visibles).
2. Escribir en una vista: la otra debe mostrar el **mismo borrador** sin bucles de foco.
3. Cambiar modelo / estilo / contexto / idioma / debug en una vista: la otra refleja **sin recargar**.
4. Disparar suggestion: **spinner**, texto ghost y etiqueta de modelo alineados en ambas.
5. **Enter** enviar al chat: ambas vistas se **limpian** (draft vacio).
6. Reducir ancho del panel: strip de chips **hace wrap**; controles siguen alcanzables.

#### Criterios de aceptacion P2

- [x] Flujo coherente "una sesion / dos vistas" documentado y verificable con la checklist.
- [x] `npm run check` verde.
- [x] `npm run vsix` verde.

#### Validacion

- [x] `npm run check` verde.
- [x] `npm run vsix` verde.

## Metricas de exito (v0.2.4b)

- Reducir a cero incidencias de "vistas desincronizadas" reportadas en pruebas manuales.
- Reducir friccion por controles no visibles en layouts estrechos.
- Mantener estabilidad de normalizacion sin reintroducir artefactos de espaciado.
- Aumentar percepcion de utilidad de estilos (`breve/normal/extenso`).

## Riesgos y mitigaciones

- **Riesgo:** loops de sincronizacion entre vistas al propagar draft/settings.  
  **Mitigacion:** incluir `originViewId` y aplicar no-op cuando el valor no cambia.

- **Riesgo:** mayor complejidad del protocolo host↔webview.  
  **Mitigacion:** tipado estricto de mensajes y validacion en tests de integracion.

- **Riesgo:** degradacion de UX en vista estrecha por exceso de controles.  
  **Mitigacion:** estrategia de overflow (wrap o menu "more") con prioridad de controles clave.

- **Riesgo:** cambios de estilo afecten calidad semantica de suggestions.  
  **Mitigacion:** calibracion por tests + validacion manual con prompts representativos.

## Definicion de Done (v0.2.4b)

- GhostPrompt opera como una sesion unificada en Sidebar y Panel.
- Draft, settings y estado de suggestion sincronizados en tiempo real.
- Controles con paridad funcional en ambos layouts.
- Diferencias de estilo claramente perceptibles y estables.
- Documentacion de release actualizada para el nuevo modelo de sincronizacion.
