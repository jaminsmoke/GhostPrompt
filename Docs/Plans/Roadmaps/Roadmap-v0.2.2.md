# Roadmap v0.2.2 - GhostPrompt

> **Estado:** En ejecucion (Sprint 1, 2 y 3 completados; Sprint 4 en cierre)  
> **Objetivo:** Mejorar calidad contextual de suggestions, robustez del ghost text y tolerancia de limites de requests sin perder control de coste.

## Objetivo de v0.2.2

Hacer que GhostPrompt sugiera texto mas alineado al proyecto real, elimine casi por completo fallos de union visual/textual del ghost text, y reduzca bloqueos prematuros por limites de requests en sesiones normales de uso.

## Problemas priorizados

1. El contexto actual de suggestions es util pero limitado a sesion local (no incorpora suficiente senal del proyecto/archivo).
2. El ghost text a veces se "pega" o presenta pequenos artefactos de union en casos borde.
3. Los limites por defecto de requests son demasiado conservadores para sesiones prolongadas.
4. Faltan tests de no-regresion en puntos finos (overlap parcial, separacion, configuracion de governor).

## Metas de producto (v0.2.2)

- Suggestions mas relevantes al stack y tarea activa del proyecto.
- Experiencia de ghost text consistente al escribir/aceptar (`Tab`) sin uniones incorrectas.
- Menos pausas por rate/session budget en uso real, manteniendo proteccion de consumo.
- Configuracion y mensajes de estado mas claros para usuarios no tecnicos.

## Metas tecnicas (v0.2.2)

- Anadir contexto de proyecto opcional y acotado al pipeline de completions.
- Fortalecer normalizacion de suggestions con resolucion de solape parcial.
- Retunar `SuggestionRequestGovernor` con defaults mas generosos.
- Ampliar cobertura de tests en normalizacion, UI ghost behavior y limites.

## Plan ejecutable

### Sprint 1 - P0 (Alto impacto inmediato)

- [x] Retunar defaults del governor:
  - `rateLimitMaxRequests`: `40 -> 90`
  - `rateLimitWindowMs`: mantener `600000` (10 min)
  - `sessionRequestBudget`: `120 -> 300`
  - `requestCooldownMs`: `700 -> 500`
  - mantener `minCharsForSuggestion = 6`
- [x] Revisar mensajes UI de bloqueo para que sean accionables ("ajusta limites en Settings").
- [x] Anadir trazas debug especificas de presupuesto restante y consumo por ventana.

#### Criterios de aceptacion P0

- En sesion de escritura continua (10-15 min) disminuyen significativamente los bloqueos por `rate-limited` y `session-budget-exhausted`.
- El usuario entiende por que se bloquea y como ajustarlo sin salir del flujo.

### Sprint 2 - P1 (Calidad contextual de suggestions)

- [x] Extender `contextMode` con opcion `project` (ademas de `off|basic`).
- [x] Incorporar senales de contexto del entorno activo:
  - nombre de workspace
  - archivo activo (ruta relativa + lenguaje)
  - seleccion breve del editor (si existe)
  - ultimas interacciones utiles de la sesion (acotadas)
- [x] Redisenar instruccion de completion en bloques:
  - intencion parcial del usuario
  - contexto de proyecto (resumido)
  - reglas de salida (continuacion pura, sin relleno)
- [x] Anadir limites estrictos de tamano de contexto para evitar prompt bloat.

#### Criterios de aceptacion P1 (Sprint 2)

- En pruebas manuales comparativas, las suggestions resultan mas especificas del proyecto y menos genericas.
- No hay incremento apreciable de latencia por el contexto adicional.

### Sprint 3 - P1 (Robustez del ghost text)

- [x] Mejorar `normalizeSuggestion` para:
  - solape parcial sufijo/prefijo
  - ultima palabra incompleta
  - duplicacion de fragmentos al inicio de suggestion
- [x] Reforzar insercion segura al aceptar (`Tab`):
  - separacion palabra-palabra
  - proteccion ante duplicado de puntuacion/espacios
- [x] Ajustar render inline para evitar artefactos visuales en casos limite.

#### Criterios de aceptacion P1

- Se eliminan casos frecuentes de texto pegado o duplicado al aceptar suggestions.
- UX estable en escritura rapida, edicion al final, y prompts multilinea.

### Sprint 4 - P2 (Tests, validacion y release)

- [ ] Anadir tests unitarios nuevos: *(parcial)*
  - solape parcial en `normalizeSuggestion`
  - separadores y puntuacion en aceptacion (pendiente test dedicado de UI/webview)
  - lectura de nuevos defaults/config del governor
- [x] Anadir casos de integracion host/webview para estados de bloqueo y recuperacion.
- [ ] Ejecutar smoke test completo en ambas vistas (sidebar + panel).
- [ ] Actualizar README/changelog/release notes para `0.2.2`. *(parcial: README actualizado; pendiente cierre final de release notes al finalizar Sprint 4).*

#### Smoke test manual (pendiente de ejecucion)

- [ ] Sidebar: escribir rapido 20-30s y confirmar que solo aparece la suggestion vigente.
- [ ] Sidebar: validar `Tab` (acepta suggestion), `Enter` (envia), `Shift+Enter` (nueva linea).
- [ ] Sidebar: validar `contextMode=project` con archivo activo distinto y sugerencias coherentes.
- [ ] Panel: repetir flujo completo y confirmar paridad con Sidebar.
- [ ] Confirmar estados de UI: `loading`, `empty` (too-short/rate-limited), `error` legible.

#### Criterios de aceptacion P2

- [x] `npm run check` verde.
- [x] Sin regresiones en protocolo `loading/suggestion/empty/error/clear`.
- Release documentada con cambios de comportamiento y nuevos defaults.

### Sprint 5 - P1.5 (Idioma de suggestions)

- [x] Anadir modo de idioma para suggestions:
  - `ghostPrompt.suggestionLanguageMode`: `auto` | `manual` (default `auto`)
  - `ghostPrompt.suggestionLanguage`: idioma fijo cuando `mode=manual`
- [x] Anadir selector de idioma en webview:
  - opcion `Auto`
  - idiomas iniciales soportados (ej: `es`, `en`)
- [x] Implementar deteccion de idioma del input cuando `mode=auto`.
- [x] Reflejar en UI el idioma efectivo cuando `mode=auto` (chip/boton contextual).
- [x] Extender `buildCompletionInstruction` para forzar idioma de salida:
  - suggestion en idioma detectado/seleccionado
  - sin traducir identificadores de codigo, rutas, API names ni texto entre comillas
- [x] Anadir tests unitarios:
  - deteccion de idioma basica (`es`/`en`)
  - construccion de instruccion con idioma forzado
  - precedencia de `manual` sobre `auto`

#### Criterios de aceptacion P1.5

- [x] Input en espanol -> suggestion en espanol (modo `auto`) *(validado por tests de deteccion + instruccion forzada)*.
- [x] Input en ingles -> suggestion en ingles (modo `auto`) *(validado por tests de deteccion + instruccion forzada)*.
- [x] En modo `manual`, siempre se respeta el idioma seleccionado.
- [x] El usuario puede ver claramente el idioma activo en webview.
- [x] `npm run check` verde tras cambios de idioma.

## Metricas de exito (v0.2.2)

- Incrementar tasa de aceptacion de suggestions (medicion manual o debug-assisted).
- Reducir eventos `rate-limited` y `session-budget-exhausted` por sesion.
- Reducir incidencias UX de "ghost text pegado/duplicado" reportadas en pruebas.
- Reducir incidencias de suggestions en idioma incorrecto.
- Mantener estabilidad y latencia percibida dentro del flujo actual.

## Riesgos y mitigaciones

- **Riesgo:** contexto de proyecto excesivo degrade latencia o calidad.  
  **Mitigacion:** contexto minimo, truncado estricto y modo configurable (`off/basic/project`).

- **Riesgo:** cambios en normalizacion introduzcan cortes agresivos.  
  **Mitigacion:** tests de casos borde + fallback conservador si no hay solape claro.

- **Riesgo:** defaults mas altos aumenten consumo inesperado en algunos usuarios.  
  **Mitigacion:** mantener governor activo, mensajes claros y ajustes faciles en settings.

- **Riesgo:** deteccion de idioma inestable en inputs cortos o mixtos.  
  **Mitigacion:** umbral minimo de longitud, fallback a idioma previo o configurado, y opcion manual siempre disponible.

## Definicion de Done (v0.2.2)

- Contexto de suggestions mejorado con opcion orientada a proyecto.
- Ghost text robusto sin uniones incorrectas en casos habituales.
- Limites por defecto mas generosos y menos bloqueos prematuros.
- Cobertura de tests ampliada en los puntos criticos nuevos.
- Documentacion de release y configuracion actualizada.
