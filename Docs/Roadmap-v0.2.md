# Roadmap v0.2 - GhostPrompt

> **Estado:** Ciclo v0.2 **completado**; la extensión correspondiente es **v0.2.0**. Este documento conserva el plan y el historial de entregas.

## Objetivo de v0.2

Hacer que el flujo de sugerencias en webview sea robusto, observable y predecible, eliminando fallos silenciosos y mejorando la experiencia de escritura (sin perdida de foco), para dejar una base estable para iteraciones futuras.

## Contexto y problemas a resolver

1. Las sugerencias no siempre llegan o no se renderizan correctamente en la webview.
2. El flujo actual es fragil ante latencia y concurrencia (race conditions).
3. No hay observabilidad suficiente para diagnosticar si falla la captura, la llamada al modelo o el render.
4. Falta cobertura de tests para evitar regresiones.

## Metas de producto (v0.2)

- Sugerencias consistentes en ambos inputs (`ghostPrompt.input` y `ghostPrompt.inputPanel`).
- Cero perdida de foco al escribir o pedir sugerencias.
- Feedback explicito de estado (cargando/sin sugerencia/error) en la webview.
- Base de tests automatizados para host, protocolo y UI.

## Metas tecnicas (v0.2)

- Definir un protocolo de mensajes versionado y tipado host<->webview.
- Implementar control de concurrencia con cancelacion explicita de requests.
- Añadir telemetria/logging de depuracion (desactivable) para trazabilidad.
- Asegurar manejo explicito de respuestas vacias y errores.

## Plan ejecutable (sin issues)

### Sprint 1 (ahora) - Fase 1 / P0

- [x] Definir protocolo host<->webview v2 (`loading`, `suggestion`, `empty`, `error`, `clear`).
- [x] Implementar cancelacion explicita de request previa por cada nueva pulsacion.
- [x] Mostrar estado visible en UI para `loading`, `empty` y `error`.
- [x] Validar manualmente en Development Host (2 vistas, escritura rapida, Tab, Enter).
- [x] Ajustar textos de estado segun feedback UX.

### Sprint 2 - Fase 2 / P1

- [x] Refactorizar `CopilotCompletion` en funciones testeables (seleccion, prompt, parseo).
- [x] Añadir normalizacion de suggestion (no repetir prefijo, max longitud configurable).
- [x] Agregar modo debug con trazas por `captureId`.
- [x] Documentar flujo de depuracion en `Docs`.

### Sprint 3 - Fase 3 / P1

- [x] Configurar tests (Vitest preferido).
- [x] Cubrir unit tests de `requestCompletion` y provider.
- [x] Cubrir integracion de protocolo host/webview con mocks.
- [x] Integrar tests en pipeline local (`npm run validate` + tests).

### Sprint 3.5 - Fase 3.5 / P1.5 (Control de coste y frecuencia)

- [x] Implementar deduplicacion por `normalizedInput` (no repetir request para el mismo texto).
- [x] Implementar cache en memoria con TTL corto (30-60s) por prefijo.
- [x] Añadir rate limit por ventana (ej. max requests por 10 min) y cooldown minimo.
- [x] Añadir presupuesto de sesion para suggestions y estado UI de pausa preventiva.
- [x] Añadir metricas en debug: `requested`, `servedFromCache`, `deduped`, `rateLimited`, `sessionBlocked`.

### Sprint 3.6 - Fase 3.6 / P1.6 (Calidad contextual de suggestions)

- [x] Rediseñar la instruccion de `requestCompletion` para mantener tono/intent del usuario.
- [x] Permitir longitud flexible de respuesta (no forzar una sola frase cuando no aplique).
- [x] Incluir estrategia opcional de contexto local (ultimas sugerencias aceptadas + ultimo prompt enviado).
- [x] Añadir setting de estilo de suggestion (`concise`, `balanced`, `detailed`).
- [ ] Añadir validacion de calidad: test manual comparativo contra baseline sin extension.

### Sprint 4 - Fase 4 / P2

- [ ] Smoke test completo en ambas vistas.
- [ ] Actualizar changelog y limitaciones.
- [ ] Preparar empaquetado de release.

### Sprint 3.7 - Fase 3.7 / P1.7 (UX del input webview)

- [x] Mostrar ghost-text inline (continuacion del texto, no bloque debajo).
- [x] Añadir menu accionable dentro de la webview para policy/style/context/debug.
- [x] Persistir cambios de menu en settings de extension.
- [ ] Ajustar layout final de menu para version release (espaciado, responsive, a11y).

### Sprint 3.8 - Fase 3.8 / P1.8 (Refinamiento UX de controles)

- [x] Eliminar dropdown dentro de dropdown en opciones del input.
- [x] Sustituir selects por controles de tipo chip/segmentado mas directos.
- [x] Mejorar semantica de labels de estilo (`Breve`, `Normal`, `Extenso`).
- [x] Mantener layout compacto sin empujar el bloque principal del input.

### Sprint 3.9 - Fase 3.9 / P1.9 (UX polish menor)

- [x] Ajuste fino del ghost-text inline para considerar scroll con suggestion larga.
- [x] Evitar que el frame oculte el boton de enviar en activity bar (layout anclado).
- [x] Ajustes visuales menores de densidad/espaciado por tema.
- [x] Mejoras a11y (focus visible y navegacion teclado en chips).

### Checklist de ejecucion diaria

1. Ejecutar `npm run validate`.
2. Levantar Extension Development Host (`F5`).
3. Probar flujo rapido: escribir -> suggestion -> `Tab` -> `Enter`.
4. Repetir en sidebar y panel inferior.
5. Registrar resultado en `Docs/MyConversation/conversation.md`.

---

## Fase 1 - Estabilizacion critica (P0)

### Entregables Fase 1

- **Contrato de mensajes v2** con tipos explicitos:
  - `suggest`
  - `suggestion`
  - `empty`
  - `error`
  - `clear`
- **Request manager por vista**:
  - cancela request previa al llegar nueva entrada,
  - conserva `captureId` activo,
  - ignora respuestas tardias con motivo registrado.
- **Manejo de estado en webview**:
  - estado `loading`,
  - estado `no suggestion`,
  - estado `error` (no silencioso).

### Criterios de aceptacion Fase 1

- Escribiendo rapido durante 30 segundos, no hay errores visibles y solo se muestra la ultima sugerencia valida.
- Cuando el modelo no esta disponible, el usuario ve estado "sin sugerencia" o "modelo no disponible", no silencio.
- No hay saltos de foco fuera del textarea durante escritura normal, `Tab` y `Enter`.

---

## Fase 2 - Arquitectura y calidad de codigo (P1)

### Entregables Fase 2

- Refactor de `CopilotCompletion` para separar:
  - seleccion de modelo,
  - construccion de prompt/instruccion,
  - streaming y normalizacion de salida.
- Normalizacion de sugerencias:
  - trim consistente,
  - proteccion ante repeticion exacta del prefijo,
  - limite de longitud configurable.
- Modo debug interno (`GhostPrompt: Toggle Debug`) con logs estructurados.

### Criterios de aceptacion Fase 2

- El flujo de sugerencias tiene funciones pequenas y testeables.
- Con debug activado, se puede reconstruir una sesion completa de suggestion por `captureId`.

---

## Fase 3 - Test suite y no-regresion (P1)

### Entregables Fase 3

- Setup de tests con **Vitest** (preferido por simplicidad) o Jest si el equipo lo prefiere.
- Tests unitarios minimos:
  - `requestCompletion`: sin modelo, error, respuesta valida.
  - `MiniInputViewProvider`: enrutado de mensajes y estados.
  - utilidades de normalizacion de suggestion.
- Tests de integracion host/webview (mock de `postMessage`):
  - suggest -> suggestion,
  - suggest -> empty,
  - suggest -> error,
  - descarte por `captureId` viejo.
- Checklist manual de UX:
  - foco estable,
  - `Tab` acepta suggestion,
  - `Enter` envia y limpia.

### Criterios de aceptacion Fase 3

- Pipeline CI ejecuta tests y build en cada PR.
- Cobertura minima inicial: 60% en modulos criticos de sugerencias.

---

## Fase 4 - Release v0.2 (P2)

### Entregables Fase 4

- Changelog con problemas corregidos.
- Documentacion de limitaciones conocidas.
- Smoke test en Extension Development Host y empaquetado VSIX.

### Criterios de aceptacion Fase 4

- `npm run validate` y tests verdes.
- Escenario "escribir rapido + aceptar + enviar" estable en las dos vistas.

---

## Fase 3.5 - Control de coste y frecuencia (P1.5)

### Entregables Fase 3.5

- Capa antirrafaga para evitar llamadas redundantes.
- Cache de suggestions por prefijo con expiracion.
- Limite de llamadas por sesion con feedback explicito en UI.
- Telemetria de volumen real de llamadas evitadas vs ejecutadas.

### Criterios de aceptacion Fase 3.5

- Reduccion medible de llamadas al modelo en escritura continua (>50% objetivo inicial).
- Sin degradacion de UX percibida al escribir.
- Usuario puede identificar por que una suggestion fue omitida (cache/rate limit/presupuesto).

---

## Fase 3.6 - Calidad contextual de suggestions (P1.6)

### Entregables Fase 3.6

- Instruccion revisada y orientada a continuidad contextual real.
- Politica de longitud configurable por estilo (`concise`, `balanced`, `detailed`).
- Evaluacion comparativa de calidad entre extension y experiencia nativa.

### Criterios de aceptacion Fase 3.6

- Suggestions menos genericas y mas alineadas al texto parcial.
- Mayor tasa de aceptacion de suggestion en pruebas manuales.
- Ajustes de estilo verificables desde settings.

---

## Backlog post-v0.2 (v0.3 sugerido)

- Historial visual de prompts y sugerencias aceptadas.
- Ajustes de UX del ghost-text (posicionamiento, contraste, accesibilidad).
- A/B prompt templates para mejorar calidad de completions.

## Riesgos y mitigaciones

- **Riesgo:** API `vscode.lm` con comportamiento variable segun sesion de Copilot.  
  **Mitigacion:** fallback de estados + mensajes de error claros + tests con mocks.

- **Riesgo:** complejidad de sincronizacion entre dos vistas.  
  **Mitigacion:** state manager por instancia de webview y protocolo comun tipado.

- **Riesgo:** regresiones al tocar flujo de input/teclado.  
  **Mitigacion:** tests de teclado + checklist manual obligatorio pre-release.

## Definicion de Done para v0.2

- Flujo de sugerencias robusto y observable.
- Sin perdida de foco.
- Errores no silenciosos.
- Tests automatizados para caminos criticos.
- Documentacion de arquitectura y depuracion actualizada en `Docs`.
