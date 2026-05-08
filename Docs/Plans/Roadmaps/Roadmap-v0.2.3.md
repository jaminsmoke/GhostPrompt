# Roadmap v0.2.3 - GhostPrompt

> **Estado:** Propuesto (pendiente de ejecucion)  
> **Objetivo:** Pulir bordes de UX en ghost text, mejorar transparencia/control del modelo usado y reforzar consistencia de idioma/cache.

## Objetivo de v0.2.3

Cerrar puntos finos de calidad percibida en suggestions para que la experiencia sea mas coherente y explicable: separacion correcta de texto en fronteras de puntuacion, selector de modelo redisenado con estado `Included/Premium`, y comportamiento robusto en idioma/caching.

## Problemas priorizados

1. En ciertos casos de puntuacion (ej: `:`) la suggestion aparece pegada al texto previo.
2. El control actual de modelo no muestra de forma clara el modelo exacto usado ni su categoria `Included/Premium`.
3. El cache de suggestions puede mezclar resultados entre configuraciones distintas (idioma/estilo/contexto).
4. La deteccion de idioma en entradas cortas o mixtas puede oscilar.

## Metas de producto (v0.2.3)

- UX de ghost text sin artefactos de union en casos de puntuacion comunes.
- Selector de modelo redisenado: lista clara de modelos con etiqueta visible `Included` o `Premium`.
- Mayor transparencia: usuario sabe que modelo se usa para la suggestion actual.
- Sugerencias mas consistentes con idioma/configuracion activa.

## Metas tecnicas (v0.2.3)

- Endurecer reglas de separacion de frontera (`context` vs `suggestion`) en render y aceptacion.
- Introducir descriptor de modelo normalizado (`id/name/family/tier`) para logs y UI.
- Redefinir key de cache para incluir dimensiones de salida.
- Estabilizar resolucion de idioma con umbral/histeresis/fallback.

## Plan ejecutable

### Sprint 1 - P0 (Pulido de normalizacion de frontera)

- [x] Ampliar reglas de separacion para puntuacion (`:`, `;`, `,`) cuando suggestion inicia en palabra.
- [x] Mantener proteccion de duplicados de puntuacion/espacios (`..`, `,,`, dobles espacios).
- [x] Unificar reglas entre:
  - render inline
  - insercion final al aceptar con `Tab`
  - calculo de altura del composer
- [x] Anadir tests unitarios de frontera de puntuacion.

#### Criterios de aceptacion P0

- [x] `Ejemplo:` + `continuacion` se renderiza e inserta como `Ejemplo: continuacion`.
- [x] No aparecen regresiones en saltos de linea o suggestions que ya traen espacio inicial.
- [x] `npm run check` verde.

### Sprint 2 - P1 (Selector de modelo redisenado + tier Included/Premium)

- [x] Sustituir el control actual de modelo por una lista de modelos disponibles.
- [x] Mostrar por opcion:
  - nombre legible del modelo
  - etiqueta de tier (`Included` / `Premium`)
- [x] Mantener policy de seguridad (`nonPremiumOnly`) como modo rapido/filtro.
- [x] Guardar modelo seleccionado por el usuario (persistencia en settings).
- [x] Mostrar en estado/debug el modelo efectivamente usado por request.

#### Criterios de aceptacion P1 (Sprint 3)

- [x] El usuario ve una lista de modelos concreta, no solo modo abstracto.
- [x] Cada modelo visible incluye tier `Included/Premium`.
- [x] El modelo elegido en UI se respeta al pedir suggestions (cuando aplica).
- [x] `npm run check` verde.

### Sprint 3 - P1 (Transparencia de modelo usado en pipeline)

- [x] Extender `requestCompletion` para exponer metadata del modelo seleccionado (`id`, `name`, `family`, `tier`).
- [x] Registrar metadata del modelo en logs de debug por `captureId`.
- [x] Enviar metadata del modelo a webview para feedback contextual.
- [x] Anadir tests de seleccion de modelo + metadata.

#### Criterios de aceptacion P1

- [x] Cada request valida deja trazable que modelo respondio.
- [x] La UI puede reflejar modelo activo sin ambiguedad.
- [x] `npm run check` verde.

### Sprint 4 - P1.5 (Cache key robusta por configuracion)

- [x] Rehacer key del governor incluyendo:
  - texto normalizado
  - idioma efectivo
  - estilo de suggestion
  - modo/contexto relevante
  - (opcional) modelo/policy
- [x] Evitar cache hits cruzados entre `ES/EN` o estilos distintos.
- [x] Añadir tests de no-colision de cache entre configuraciones.

#### Criterios de aceptacion P1.5 (Sprint 5)

- [x] No se sirven suggestions de cache en idioma/estilo incorrecto.
- [x] Metrica de cache sigue aportando ahorro real sin degradar coherencia.
- [x] `npm run check` verde.

### Sprint 5 - P1.5 (Estabilidad de deteccion de idioma)

- [x] Aplicar umbral minimo de texto para deteccion fiable.
- [x] Añadir hysteresis para reducir cambios bruscos de idioma en inputs cortos.
- [x] Definir fallback de baja confianza:
  - idioma previo efectivo, o
  - idioma manual configurado.
- [x] Tests de entradas mixtas (texto natural + codigo + prompts cortos).

#### Criterios de aceptacion P1.5

- [x] Menos oscilacion de idioma en escritura incremental.
- [x] Deteccion mas estable en prompts tecnicos mixtos.
- [x] `npm run check` verde.

### Sprint 6 - P2 (Validacion final y release)

- [ ] Smoke test completo en ambas vistas (sidebar + panel).
- [ ] Verificacion manual de selector de modelo (lista + tier + persistencia).
- [ ] Verificacion manual de bordes de puntuacion y cache por idioma/estilo.
- [x] Actualizar README/CHANGELOG con cambios de `0.2.3`.
- [x] Generar VSIX y validar instalacion local.

#### Criterios de aceptacion P2

- [x] `npm run check` verde.
- [x] `npm run vsix` verde.
- [ ] Flujo de suggestions estable y explicable para usuario final. *(pendiente smoke/manual checks de Sprint 6).*

### Sprint 7 - Hotfix (Deduplicacion de modelos visibles)

- [x] Deduplicar lista de modelos del selector para evitar entradas repetidas del mismo modelo visible.
- [x] Usar clave canonica de visualizacion (label + tier + pricing) en la lista mostrada.
- [x] Añadir test de regresion para repetir `GPT-4o` con IDs distintos y comprobar colapso a una sola opcion.
- [x] Ordenar/agrupar selector por proveedor inferido para mejorar escaneabilidad.
- [x] Refinar visualizacion final del tier/coste con tokens textuales compactos (`[INCLUDED 0x]`, `[PREMIUM 1x]`, `[UNKNOWN]`).

#### Criterios de aceptacion Hotfix

- [x] El selector no muestra el mismo modelo visible varias veces.
- [x] El selector muestra bloques por proveedor con orden estable.
- [x] Tier/coste legible a primera vista sin ruido visual de indicadores redundantes.
- [x] `npm run check` verde.

## Metricas de exito (v0.2.3)

- Reducir incidencias de suggestion pegada por puntuacion.
- Reducir incidencias de suggestion en idioma/configuracion incorrecta por cache.
- Incrementar claridad percibida del origen de suggestion (modelo/tier).
- Mantener o mejorar tasa de aceptacion de suggestions.

## Riesgos y mitigaciones

- **Riesgo:** la API de VS Code no expone metadata completa de todos los modelos.  
  **Mitigacion:** usar `id/name/family` disponibles con fallback `unknown` y tier heuristico documentado.

- **Riesgo:** rediseno de selector de modelos puede sobrecargar la UI compacta.  
  **Mitigacion:** modo compacto con tooltip/detalle expandible y labels cortas.

- **Riesgo:** cache key mas rica reduzca hit-rate excesivamente.  
  **Mitigacion:** instrumentar metricas antes/despues y ajustar dimensiones incluidas.

- **Riesgo:** reglas de puntuacion demasiado agresivas en idiomas mixtos.  
  **Mitigacion:** tests de frontera multilenguaje + fallback conservador.

## Definicion de Done (v0.2.3)

- Frontera de sugerencia robusta en puntuacion habitual.
- Selector de modelo redisenado con lista y tier `Included/Premium`.
- Modelo efectivo trazable en pipeline (logs + UI).
- Cache coherente con idioma/estilo/configuracion activa.
- Documentacion y VSIX listos para validacion final.
