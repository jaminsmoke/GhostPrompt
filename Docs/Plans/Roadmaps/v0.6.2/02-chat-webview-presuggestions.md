# FF-FJ - Chat webview + pre-suggestions (v0.6.2)

> **Objetivo:** Corregir problemas de visualizacion y consistencia de las pre-suggestions en el chat de la webview, especialmente cuando hay respuestas antiguas, sincronizacion entre vistas o desalineacion del overlay ghost.
>
> **Version objetivo:** `0.6.2` (`package.json`).
>
> **Fuera de alcance:** Cambiar motores LM, reescribir el protocolo host-webview, o redisenar toda la toolbar.

---

## Historico dual-view (tras plan 05 FY, v0.6.2)

El panel inferior dejo de ser un segundo chat: ya no existe el mensaje host→webview `draftSync` ni sincronizacion de borrador entre dos compositores. La fase **FG** de este plan sigue aplicando a **`draftHydrate`** al reabrir el sidebar (borrador persistido en el host) y a la correlacion `captureId`; las tareas y tests que mencionaban **dos chats** enlazados por `draftSync` son **legacy** de producto.

---

## Diagnostico inicial

| Area | Hallazgo | Archivos principales |
| ---- | -------- | -------------------- |
| Correlacion | Al escribir se limpia la suggestion, pero el `captureId` no se invalida hasta que se dispara la siguiente request tras el debounce. Una respuesta antigua puede repintarse durante esa ventana. | `useGhostPromptHandlers.ts`, `useGhostPromptDerived.ts`, `ghostPromptInboundUtilities.ts` |
| Dual webview | `draftHydrate` / `draftSync` actualizan `text`, pero no limpian siempre la suggestion anterior. Puede quedar ghost text de otro borrador. | `handleGhostPromptInboundMessage.ts` |
| Overlay | El overlay ghost y el textarea no comparten exactamente todas las reglas de caja/scroll (`scrollbar-gutter`, overflow, sizing), lo que puede provocar saltos o wrap diferente. | `PromptInput.tsx`, `index.css`, `PromptInput.test.tsx` |
| UX chat | En destino VSOpenCodeX el placeholder invita a escribir en un textarea deshabilitado. Algunos estados mezclan "suggestion" y "sugerencia". | `PromptInput.tsx`, `BottomBar.tsx`, `handleGhostPromptInboundMessage.ts` |
| Cobertura | Los tests cercanos pasan, pero no cubren la carrera entre cambio de texto y respuesta stale dentro del debounce. | `useGhostPrompt.test.ts`, `PromptInput.test.tsx`, `MiniInputViewProvider.test.ts` |

---

## Fase FF - Invalidacion inmediata de respuestas stale

> **Motivo:** El bug mas probable en pre-suggestions incorrectas es una respuesta valida para un texto anterior que llega despues de que el usuario ya cambio el borrador, pero antes de que exista un `captureId` nuevo.

| # | Tarea | Archivo / accion |
| - | ----- | ---------------- |
| F1 | Invalidar la captura activa en cada cambio local de texto antes de esperar al debounce | `useGhostPromptHandlers.ts` |
| F2 | Mantener `currentCaptureId` monotono y documentar que representa "draft generation", no solo request enviada | `ghostPromptUiState.ts` / comentario breve |
| F3 | Asegurar que `loading`, `suggestion`, `suggestion-stream`, `empty` y `error` antiguos se descartan tras editar | `ghostPromptApplyInboundCaptureReference` |
| F4 | Test unitario: respuesta antigua no vuelve a pintar suggestion tras `handleTextChange` y antes del nuevo debounce | `useGhostPrompt.test.ts` o test nuevo del handler |

**Criterio de hecho:** Una respuesta con `captureId` anterior al ultimo cambio de texto no modifica `suggestion`, `isLoading` ni `status` visible.

---

## Fase FG - Limpieza de suggestion en sync/hydrate dual-view

> **Motivo:** Sidebar y panel comparten borrador. Si una vista recibe un borrador remoto, cualquier pre-suggestion local queda automaticamente fuera de contexto.

| # | Tarea | Archivo / accion |
| - | ----- | ---------------- |
| G1 | Limpiar `suggestion` al aplicar `draftHydrate` | `handleGhostPromptInboundMessage.ts` |
| G2 | Limpiar `suggestion` al aplicar `draftSync` desde otra vista | `handleGhostPromptInboundMessage.ts` |
| G3 | Invalidador de captura tambien en borradores remotos, para descartar streams/suggestions previas | `handleGhostPromptInboundMessage.ts` + utilities |
| G4 | Tests de `draftHydrate` y `draftSync`: texto nuevo implica suggestion vacia y siguiente request se salta una vez | `useGhostPrompt.test.ts` / handler tests |

**Criterio de hecho:** Ninguna vista muestra ghost text que haya sido calculado para un draft distinto.

---

## Fase FH - Alineacion visual del overlay ghost

> **Motivo:** La UI usa una capa ghost encima del textarea con el texto del usuario invisible y la suggestion visible. El truco funciona solo si ambos elementos tienen caja, fuente, wrap y scroll equivalentes.

| # | Tarea | Archivo / accion |
| - | ----- | ---------------- |
| H1 | Extraer clases compartidas de caja/scroll entre textarea y overlay, incluyendo gutter/box sizing si aplica | `PromptInput.tsx` |
| H2 | Evitar scrollbar propia visible en overlay sin cambiar el ancho de layout frente al textarea | `index.css` |
| H3 | Revisar altura minima compacta/no compacta y crecimiento con contenido multilinea | `PromptInput.tsx` |
| H4 | Ampliar tests para clases criticas del overlay y textarea | `PromptInput.test.tsx` |

**Criterio de hecho:** En texto largo, multilinea y con scroll, la suggestion empieza exactamente donde termina el texto del usuario.

---

## Fase FI - Pulido UX del chat

> **Motivo:** La experiencia del chat debe ser clara incluso cuando el destino no es Copilot Chat o cuando no hay suggestion disponible.

| # | Tarea | Archivo / accion |
| - | ----- | ---------------- |
| I1 | Ajustar placeholder/texto en modo VSOpenCodeX para no sugerir escribir en un textarea deshabilitado | `PromptInput.tsx`, `App.tsx` |
| I2 | Unificar copy visible: preferir "sugerencia" en UI de usuario y reservar `suggestion` para logs/protocolo | `BottomBar.tsx`, `handleGhostPromptInboundMessage.ts` |
| I3 | Revisar estados de loading/empty/success para que no tapen errores accionables | `BottomBar.tsx`, `suggestionNotification.ts` si aplica |
| I4 | Asegurar que Enter no intenta enviar si `canSend` es false y que el estado no queda en "Enviando..." en fallos | `useGhostPromptHandlers.ts`, `inboundHandlers.ts` |

**Criterio de hecho:** La webview comunica claramente si se puede escribir, aceptar, enviar o si el destino activo delega el chat a VSOpenCodeX.

---

## Fase FJ - Verificacion y QA manual

| # | Tarea |
| - | ----- |
| J1 | `npm.cmd run test -- src/ui/webview/react/components/PromptInput.test.tsx src/ui/webview/react/hooks/useGhostPrompt.test.ts src/ui/provider/MiniInputViewProvider.test.ts` |
| J2 | `npm.cmd run typecheck:webview` |
| J3 | `npm.cmd run build:webview` |
| J4 | Smoke manual: escribir rapido, esperar suggestion, seguir escribiendo antes de que llegue otra respuesta |
| J5 | Smoke dual-view: sidebar + panel abiertos, editar en uno y verificar que el otro no conserva ghost text viejo |
| J6 | Smoke destino VSOpenCodeX: copy coherente, composer deshabilitado sin instrucciones contradictorias |

**Criterio de hecho:** Tests verdes y smoke manual sin pre-suggestions stale, desalineadas o asociadas a otro borrador.

---

## Orden recomendado

1. **FF** primero: corrige el riesgo funcional principal.
2. **FG** despues: elimina residuos entre sidebar/panel.
3. **FH** con capturas o QA visual: corrige la presentacion.
4. **FI** como pulido de UX.
5. **FJ** para cerrar con pruebas y smoke.

---

## Registro de ejecucion

| Fecha | Fase | Resultado |
| ----- | ---- | --------- |
| 2026-05-18 | - | Roadmap creado tras auditoria de chat webview/pre-suggestions. Tests cercanos actuales pasan: 26 tests OK. |
| 2026-05-18 | FF | `bumpDraftCaptureGeneration` en cada `handleTextChange`; tests stale capture; `isLoading` se limpia al editar. |
| 2026-05-18 | FG | `applyRemoteDraftRelay` en `draftHydrate`/`draftSync`; tests handler + utility. |
| 2026-05-19 | FH | Grid `gp-prompt-field`, clases editor compartidas, gutter compensado vía `paddingRight`, scroll sincronizado, CSS tipografía VS Code, tests ampliados. |
| 2026-05-19 | FH fix | Crash `Cannot read properties of null (reading 'style')`: guard `isMountedElement` (refs React `null` al desmontar overlay); sync ghost solo si overlay visible. |
| 2026-05-20 | Post-FY | Plan 05 FY elimina `draftSync`; dual segunda vista sin segundo chat. FG queda acotada a `draftHydrate` + capturas. |

## Bitacora

| Fecha | Nota |
| ----- | ---- |
| 2026-05-18 | Hallazgos iniciales: carrera `captureId` durante debounce, suggestion no limpiada en sync/hydrate, overlay con posible desalineacion, UX contradictoria en VSOpenCodeX. |
