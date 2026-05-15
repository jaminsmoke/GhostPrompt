# Fase D — Clarificar ownership de schemas webview

> **Severidad:** 🟡 MEDIUM
> **Auditoría:** Los Zod schemas de mensajes webview viven en `system/contracts/` pero son protocolo, no infraestructura
> **Confusión:** Un desarrollador buscaría schemas de webview en `api/`, no en `system/`

---

## Problema

`src/system/contracts/webviewMessageSchemas.ts` contiene los contratos de comunicación host↔webview. Estos son **protocolos de API**, no infraestructura transversal. Viven en `system/` solo porque el bundle webview necesita importarlos y `system/` tiene menos restricciones de importación.

## Solución

**Opción recomendada:** Mover a `api/contracts/webviewMessageSchemas.ts` y configurar el tsconfig del webview para permitir imports desde `api/`. Alternativa: renombrar `system/contracts/` → `system/schemas/` para reflejar mejor su propósito.

---

## Subfases

### D1 — Decidir enfoque

- [x] Evaluar restricciones del tsconfig del webview (`src/ui/webview/tsconfig.json`)
- [x] Decisión: mover a `api/contracts/webviewMessageSchemas.ts` (más semántico como protocolo de API)
- [x] Documentar decisión en este roadmap

**Criterio de hecho:** Decisión registrada con justificación técnica.

---

### D2 — Ejecutar el cambio

- [x] Mover `system/contracts/webviewMessageSchemas.ts` → `api/contracts/webviewMessageSchemas.ts`
- [x] Mover `system/contracts/webviewMessageSchemas.test.ts` → `api/contracts/webviewMessageSchemas.test.ts`
- [x] Actualizar `api/protocols/webviewProtocols.ts` para importar desde `../contracts/`
- [x] Actualizar `tsconfig.json` del webview para apuntar a `../../api/contracts/webviewMessageSchemas.ts`
- [x] Actualizar comentario en `ui/provider/MiniInputViewProvider.ts`
- [x] Eliminar `system/contracts/` (quedó vacío)

**Criterio de hecho:** El archivo existe en su nueva ubicación; `api/protocols/webviewProtocols.ts` importa correctamente.

---

### D3 — Actualizar tests

- [x] `src/api/contracts/webviewMessageSchemas.test.ts`: imports ya correctos (`./webviewMessageSchemas`)
- [x] `src/api/protocols/webviewProtocols.test.ts`: imports ya correctos
- [x] Webview build pasa sin errores

**Criterio de hecho:** `npm run build:webview` y `npm run check` pasan.

---

## Estado

| Subfase                           | Estado |
| --------------------------------- | ------ |
| D1 — Decisión documentada         | [ ]    |
| D2 — Ejecutar movimiento/renombre | [ ]    |
| D3 — Tests y build                | [ ]    |

---

## Archivos resumen

| Archivo                                         | Acción                                 |
| ----------------------------------------------- | -------------------------------------- |
| `src/system/contracts/webviewMessageSchemas.ts` | Mover a `api/contracts/` o rename dir  |
| `src/api/protocols/webviewProtocols.ts`         | Actualizar import                      |
| `src/ui/webview/tsconfig.json`                  | Posible actualización de paths         |
| `vite.config.ts`                                | Posible actualización de resolve alias |
| `tests/shared/webviewMessageSchemas.test.ts`    | Actualizar ruta                        |
