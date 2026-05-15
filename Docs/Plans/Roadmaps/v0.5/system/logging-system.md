# Sistema de Logging Unificado

> Roadmap v0.5 — Fase sistema de log
> Objetivo: Reemplazar los 4 mecanismos de logging dispersos por un sistema único, estructurado y extensible.

**Alineación con el árbol actual (v0.6+):** el pipeline de `suggest` vive en `src/core/suggest/runSuggest.ts` (antes `suggestPipeline.ts`). Las rutas y tablas de migración de este documento deben referenciar ese módulo. Los _stages_ `request-cache-hit` / `request-blocked` aparecen en documentación histórica del governor; **en el hot path actual de `runSuggest` no hay llamadas** a `logSuggestionDebug` con esos nombres — si el governor u otros motores vuelven a emitirlos, deben pasar por el mismo `Logger` con `module` acorde (p. ej. `suggest`, `engines`, `policies`).

---

## 1. Problema actual

Existen **4 mecanismos de logging independientes** sin interfaz común:

| Mecanismo                  | Archivo                           | Problemas                                                                                           |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| OutputChannel debug        | `system/debug/SuggestionDebug.ts` | 5 funciones (2 muertas), gate binario debug sí/no, sin niveles, OutputChannel nunca se hace dispose |
| File append sugerencias    | `system/log/SuggestionLog.ts`     | Solo texto plano markdown, errores de escritura silenciados, formato no parseable                   |
| File append conversaciones | `system/log/ConversationLog.ts`   | Solo texto plano markdown, errores de escritura silenciados, formato no parseable                   |
| `console.*` dispersos      | 5 archivos (host)                 | Sin control, sin metadata, sin estructura                                                           |

### Síntomas concretos

- Para rastrear un error hay que mirar 4 lugares distintos
- No hay correlación cross-cutting (captureId solo en el pipeline, no en errores de escritura)
- Añadir un nuevo "tipo de log" (ej: métricas) implica crear otro archivo desde cero
- Sin camino a telemetría sin reescribir todo

---

## 2. Arquitectura propuesta

```text
src/system/log/
├── levels.ts                    → Umbral numérico interno + tipo etiqueta JSON `LogLevelName`
├── types.ts                     → LogEntry, LogTransport, LogData, Breadcrumb
├── breadcrumbs.ts               → Ring buffer de eventos por captureId
├── Logger.ts                    → Logger class (module-scoped, inmutable)
├── LogManager.ts                → Singleton: factory, registro de transports, lifecycle
├── transports/
│   ├── outputChannel.ts         → Transporte VS Code OutputChannel (nivel configurable)
│   └── file.ts                  → Transporte dual: NDJSON + Markdown
└── index.ts                     → Barrel público
```

### 2.1 Log levels

Uso **interno** de orden numérico para comparar umbrales; en **JSON / tipos públicos** usar siempre etiquetas string (evita el footgun de TypeScript `keyof typeof` sobre `enum` numérico, que mezcla claves directas e inversas).

```ts
/** Etiqueta serializada en LogEntry / NDJSON (única fuente de verdad en wire format). */
export type LogLevelName = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}
```

- Cada nivel incluye los niveles de más severidad.
  - `DEBUG` muestra todo.
  - `INFO` muestra `INFO`, `WARN` y `ERROR`.
  - `WARN` muestra `WARN` y `ERROR`.
  - `ERROR` muestra solo `ERROR`.
- El nivel mínimo se configura vía `ghostPrompt.logLevel` (default: `"info"`).
- **`ghostPrompt.debugSuggestions` (shim):** si está `true` y el usuario **no** ha fijado un `logLevel` explícito en configuración, se trata como **efecto debug** (equivalente práctico a ver nivel `DEBUG`). Si `logLevel` está definido explícitamente, **gana `logLevel`**; el shim no lo sobrescribe. Documentar este orden en `package.json` + release notes para evitar confusiones.

**Futuro (post-v0.5):** Se puede añadir `METRICS` como nivel 4, filtrable independientemente.

### 2.2 LogEntry (estructura canónica)

```ts
interface LogEntry {
  timestamp: string; // ISO 8601
  level: LogLevelName;
  module: string; // e.g. "suggest", "inbound", "vsOpenCodeX", "memory", "engines"
  message: string; // Código del evento, e.g. "request-start", "request-success"
  captureId?: number; // Correlación pipeline
  data?: Record<string, unknown>; // Metadata estructurada
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  breadcrumbs?: Breadcrumb[]; // Últimos N eventos del mismo captureId (solo en ERROR/WARN)
}
```

### 2.3 Breadcrumbs

```ts
interface Breadcrumb {
  level: LogLevelName;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
```

Ring buffer en `LogManager`:

- Máximo 20 breadcrumbs por `captureId` activo (evicción FIFO).
- En cada llamada a `log.error()` o `log.warn()`, se adjuntan los breadcrumbs del `captureId`.
- **`flushCapture(captureId)`** libera el buffer cuando el pipeline termina (success, error o cancel). **Contrato:** debe invocarse en un `finally` (o equivalente) del flujo `suggest` para no dejar entradas huérfanas si se añaden más puntos de correlación en el futuro.

### 2.4 Errores de I/O y contrato de transports

- Los transports **no deben silenciar** fallos de escritura como hoy los appenders markdown: como mínimo **incrementar contador / `log.error` al OutputChannel** (si está sano) o `console.error` de último recurso, sin tumbar la extensión.
- `write()` puede ser `async`, pero el **hot path** del pipeline no debe bloquearse esperando disco: ver §3.4.

---

## 3. Transports

### 3.1 Interfaz

```ts
interface LogTransport {
  readonly id: string;
  readonly minLevel: LogLevel;
  write(entry: LogEntry): Promise<void>;
  dispose(): Promise<void>;
}
```

### 3.2 OutputChannelTransport

- Nombre del canal: **`"GhostPrompt Log"`** (cambio respecto al canal histórico **"GhostPrompt Suggestions"** usado por `SuggestionDebug` — documentar en release notes para usuarios que busquen el canal antiguo).
- Formato por línea: `[HH:MM:SS.mmm] [LEVEL] [module] message | {data}`
- Si hay error, incluye `| {name}: {message}` y expande stack en debug.
- Nivel mínimo respeta `ghostPrompt.logLevel`.
- **Opcional (post–MVP):** valorar `vscode.window.createOutputChannel(name, { log: true })` si la versión mínima de VS Code del manifest lo permite, para integrar con el visor de log nativo; el modelo interno sigue siendo `LogEntry` → adaptador al API.

### 3.3 FileTransport (dual format)

- Directorio base: `{globalStorageUri}/ghostPrompt/logs/v1/`
- **Contenido lógico:** cada evento se persiste como NDJSON + línea/sección en Markdown (misma semántica que §2.2).

| Archivo         | Formato                             | Propósito                                            |
| --------------- | ----------------------------------- | ---------------------------------------------------- |
| `events.ndjson` | NDJSON (una línea = un JSON válido) | Parseable por máquina, pipeline de telemetría futura |
| `session.md`    | Markdown con secciones por sesión   | Lectura humana directa                               |

### 3.4 Rendimiento y cola (FileTransport)

- **No bloquear el hot path** del `suggest` esperando `fs` en cada log: el `Logger` / `LogManager` debe **encolar** entradas hacia el FileTransport y vaciar en micro-lotes (`setImmediate` / `queueMicrotask` / `process.nextTick` según entorno) o `await` solo en `dispose()` / shutdown.
- **Backpressure:** si la cola supera un umbral razonable, degradar con contador + `log.warn` (módulo `system/log`) o descartar solo niveles bajos (`DEBUG`), nunca `ERROR`.
- La interfaz `LogTransport.write()` puede seguir siendo `async`; la política de _fire-and-forget_ vs _await_ queda centralizada en el manager, no en cada call site.

Ejemplo `events.ndjson`:

```json
{"timestamp":"2026-05-14T10:30:00.000Z","level":"INFO","module":"suggest","message":"request-start","captureId":1,"data":{"chars":42,"source":"copilot"}}
{"timestamp":"2026-05-14T10:30:01.200Z","level":"INFO","module":"suggest","message":"request-success","captureId":1,"data":{"suggestionChars":38,"model":"gpt-4o-mini"}}
```

Ejemplo `session.md`:

```markdown
# GhostPrompt Log — 2026-05-14

## Sesión 2026-05-14T10:30:00.000Z

### INFO suggest request-start

captureId=1 chars=42 source=copilot

### INFO suggest request-success

captureId=1 suggestionChars=38 model=gpt-4o-mini
```

**Rotación:** Cuando `events.ndjson` supera 5 MB, se comprime a `events.2026-05-14.ndjson.gz` y se crea uno nuevo.

- `session.md` también rota para evitar crecimiento indefinido. El diseño puede retener un máximo limitado de archivos de sesión legibles (por ejemplo, `session.md`, `session.1.md`, `session.2.md`) antes de eliminar o archivar los más antiguos.

---

## 4. Uso en cada módulo

### 4.1 Obtener logger

```ts
// Cada módulo pide un logger al inicio (nombre estable para filtrar en NDJSON)
const log = getLogger('suggest');
// En otro módulo:
const log = getLogger('memory');
```

### 4.2 Loguear

```ts
// INFO — eventos normales del flujo
log.info('request-start', { captureId: 1, chars: text.length, source: routedSource });

// DEBUG — detalles finos (solo cuando debugSuggestions = true o logLevel = "debug")
log.debug('emit-loading-phase', { captureId: 1, phase: 'opencode-start' });

// WARN — cosas que funcionan pero no deberían pasar
log.warn('cache-ttl-expired', { captureId: 1 });

// ERROR — fallos recuperables o no
log.error('request-failed', { captureId: 1 }, err);
// Los breadcrumbs del captureId se adjuntan automáticamente
```

> Nota de inicialización: los primeros módulos de arranque que se cargan antes de que el logger esté listo pueden usar `console.error` como fallback. Una vez inicializado `LogManager`, el sistema debe emitir únicamente con el logger estructurado para mantener la consistencia.

---

## 5. Plan de migración (5 fases)

### Fase 1 — Core del sistema (este PR)

**Archivos a crear:**

- `src/system/log/levels.ts`
- `src/system/log/types.ts`
- `src/system/log/breadcrumbs.ts`
- `src/system/log/Logger.ts`
- `src/system/log/LogManager.ts`
- `src/system/log/transports/outputChannel.ts`
- `src/system/log/transports/file.ts`
- `src/system/log/index.ts`

**Pruebas:**

- `tests/system/log/Logger.test.ts`
- `tests/system/log/LogManager.test.ts`
- `tests/system/log/transports/outputChannel.test.ts`
- `tests/system/log/transports/file.test.ts`
- `tests/system/log/breadcrumbs.test.ts`
- **Recomendado:** tests de **cola** (no bloqueo del caller) y de **fallo de escritura** (contador / degradación sin crash).

**Dependencias:** Ninguna externa (solo VS Code API para OutputChannel y FileSystem). Valorar API `createOutputChannel(..., { log: true })` según `engines.vscode` del manifest (§3.2).

---

### Fase 2 — Reemplazar `SuggestionDebug.ts` (puntos de emisión host)

| Call site | Reemplazo |
| --- | --- |
| `src/core/suggest/runSuggest.ts` — `logSuggestionDebug` en: `request-start`, `request-discarded`, `request-success`, `request-empty`, `request-error`, `request-cancelled` | `log.info` / `log.warn` / `log.error` según severidad del evento; mismo `captureId` en `data` |
| `src/destinations/vsOpenCodeX/vsOpenCodeXDestination.ts` — `vsopencodex-inline-forward-failed` | `log.error(...)` |
| `src/api/protocols/inboundHandlers.ts` — `logDebugInfo` | `log.debug(...)` |
| `src/ui/provider/MiniInputViewProvider.ts` — `logDebugInfo` (3) | `log.debug(...)` |
| `src/extension/extension.ts` — toggle / `ensureSuggestionDebugChannel` | Registrar `LogManager`, transports y `dispose` en `deactivate()`; mapear comando `Toggle debug` a nivel `debug` o flag shim según §6 |

**Nota:** En el código actual **no** hay `logSuggestionDebug` para `request-cache-hit` ni `request-blocked` en `runSuggest`; si se reintroducen desde `system/policies` u motores, usar el mismo logger con `module` explícito.

**OpenCode perf (`logOpenCodePerfCapture` / `logOpenCodeDebug`):** hoy solo están definidos en `SuggestionDebug.ts` y **no tienen call sites en `src/engines`** — decidir en esta fase: (a) eliminar como muertos en cleanup, o (b) reexpresar como `log.debug('opencode-perf', { captureId, stage, deltaMs })` cuando el motor vuelva a necesitar trazas. Los tests `logOpenCodePerfCapture.test.ts` deben apuntar al API final elegido.

**Archivos a eliminar (tras migrar):**

- `src/system/debug/SuggestionDebug.ts`

**Pruebas a actualizar:**

- `tests/logOpenCodePerfCapture.test.ts` → adaptar al nuevo Logger (o eliminar si se retira la API)
- `tests/MiniInputViewProvider.test.ts` → actualizar mocks
- `tests/host/ghostPromptSuggestPipeline.test.ts` → actualizar mocks

---

### Fase 3 — Reemplazar `SuggestionLog.ts` + `ConversationLog.ts` (2 call sites)

- `src/api/protocols/inboundHandlers.ts` → `handleGhostPromptInboundAccept()` (`suggestion-accepted`)
- `src/api/protocols/inboundHandlers.ts` → `handleGhostPromptInboundSend()` (`prompt-sent`)

Reemplazar por `log.info('suggestion-accepted', { context, suggestion })` y `log.info('prompt-sent', { prompt })`, respectivamente.

**Archivos a eliminar:**

- `src/system/log/SuggestionLog.ts`
- `src/system/log/ConversationLog.ts`

**Migración de datos existentes (best-effort, no bloqueante):**

- En la primera activación post-actualización, intentar leer `suggestions.md` y `conversation.md` y volcar entradas reconocibles en `events.ndjson`.
- Persistir un flag `legacy-md-imported` para no repetir.
- Si el parseo falla, continuar sin migración; los archivos legacy pueden dejarse para lectura manual.

---

### Fase 4 — Reemplazar `console.*` en host (5 calls)

- `src/api/protocols/webviewProtocols.ts` — `console.warn` / `console.error`
- `src/core/memory/activate.ts` — `console.error`
- `src/system/build/verifyWebviewBundle.ts` — `console.error` opcional si el transporte no está disponible

**Meta:** mantener `console.*` solo como fallback de bootstrap, y migrar los host logs estructurados al nuevo logger.

---

### Fase 5 — Cleanup

- Eliminar `logOpenCodeDebug()` y `logOpenCodePerfCapture()` si se decide que son muertos.
- Confirmar eliminación de `SuggestionDebug.ts`, `SuggestionLog.ts`, `ConversationLog.ts` si ya no hay imports.
- Actualizar `src/system/README.md`.
- Documentar el nuevo canal `GhostPrompt Log` y la política de `ghostPrompt.logLevel` / `debugSuggestions`.

**NO se toca en esta fase:**

- `console.*` en webview React (`src/ui/webview/react/hooks/useGhostPrompt.ts`, `ErrorBoundary.tsx`)
- `system/build/verifyWebviewBundle.ts` salvo que el fallback de logging cambie explícitamente

---

## 6. Configuración

Nueva setting `ghostPrompt.logLevel` (control principal de ruido en OutputChannel y filtrado, si aplica).

```json
{
  "ghostPrompt.logLevel": {
    "type": "string",
    "enum": ["debug", "info", "warn", "error"],
    "default": "info",
    "markdownDescription": "Nivel mínimo de log. `debug` muestra todo (incluye detalle fino del pipeline), `error` solo errores."
  }
}
```

El shim `ghostPrompt.debugSuggestions` se mantiene como compatibilidad:

- Si está `true` y **`ghostPrompt.logLevel` no está fijado por el usuario**, se comporta como `DEBUG`.
- Si `ghostPrompt.logLevel` está definido explícitamente, ese valor manda.
- El comando `ghostPrompt.toggleSuggestionDebug` alterna el shim y puede abrir el canal de salida.

---

## 7. Settings del FileTransport

```json
{
  "ghostPrompt.logFileEnabled": {
    "type": "boolean",
    "default": true,
    "markdownDescription": "Cuando está activo, GhostPrompt persiste logs estructurados (NDJSON + Markdown) en almacenamiento global."
  },
  "ghostPrompt.logFileMaxBytes": {
    "type": "number",
    "default": 5242880,
    "minimum": 1048576,
    "maximum": 104857600,
    "markdownDescription": "Tamaño máximo del archivo NDJSON antes de rotación (bytes)."
  }
}
```

---

## 8. Árbol de archivos resultante

```text
src/system/log/
├── levels.ts
├── types.ts
├── breadcrumbs.ts
├── Logger.ts
├── LogManager.ts
├── transports/
│   ├── outputChannel.ts
│   └── file.ts
├── index.ts

tests/system/log/
├── Logger.test.ts
├── LogManager.test.ts
├── breadcrumbs.test.ts
├── transports/
│   ├── outputChannel.test.ts
   └── file.test.ts

{globalStorageUri}/ghostPrompt/logs/v1/
├── events.ndjson
├── events.2026-05-14.ndjson.gz
└── session.md
```

---

## 9. Criterios de aceptación

1. ✅ Todos los `logSuggestionDebug()`, `logDebugInfo()`, `appendSuggestion()`, y `append()` existentes son reemplazados por llamadas al nuevo Logger.
2. ✅ `events.ndjson` contiene un JSON por línea con la estructura completa de `LogEntry` (`level` como `LogLevelName` string).
3. ✅ `session.md` contiene el mismo contenido en formato legible con secciones por sesión.
4. ✅ Errores llevan breadcrumbs de su `captureId` y `flushCapture` se ejecuta en el flujo `suggest`.
5. ✅ OutputChannel se crea bajo demanda con el nivel correcto y se `dispose()` en `deactivate()`.
6. ✅ Migración best-effort desde `suggestions.md` / `conversation.md`.
7. ✅ Fallos de I/O del FileTransport son visibles y no silenciosos.
8. ✅ El hot path de `runSuggest` no hace `await` a escritura en disco por cada log.
9. ✅ Settings `ghostPrompt.logLevel` y `ghostPrompt.debugSuggestions` funcionan según precedencia acordada.
10. ✅ Tests unitarios para Logger, LogManager, breadcrumbs y ambos transports.
11. ✅ TypeScript strict: `--noEmit` pasa sin errores.
12. ✅ Tests existentes pasan con los mocks actualizados.

---

## 10. Prioridades de implementación

| Fase | Descripción | Depende de | Esfuerzo est. |
| --- | --- | --- | --- |
| **1** | Core: Logger, LogManager, transports, cola (§3.4) | — | ⭐⭐⭐ |
| **2** | SuggestionDebug → Logger | Fase 1 | ⭐⭐ |
| **3** | SuggestionLog + ConversationLog | Fase 1 | ⭐ |
| **4** | `console.*` en host | Fase 1 | ⭐ |
| **5** | Cleanup + docs | Fases 2-4 | ⭐ |

---

## 11. Historial de revisiones del plan

| Fecha | Cambios (resumen) |
| --- | --- |
| 2026-05-14 | Alineación v0.6+ (`runSuggest`), `LogLevelName`, `flushCapture`, I/O visible, cola FileTransport (§3.4), migración legacy best-effort, canal renombrado, precedencia settings, rutas en fases, OpenCode perf TBD. |

---

## 4. Uso en cada módulo

### 4.1 Obtener logger

```ts
// Cada módulo pide un logger al inicio (nombre estable para filtrar en NDJSON)
const log = getLogger('suggest');
// En otro módulo:
const log = getLogger('memory');
```

### 4.2 Loguear

```ts
// INFO — eventos normales del flujo
log.info('request-start', { captureId: 1, chars: text.length, source: routedSource });

// DEBUG — detalles finos (solo cuando debugSuggestions = true o logLevel = "debug")
log.debug('emit-loading-phase', { captureId: 1, phase: 'opencode-start' });

// WARN — cosas que funcionan pero no deberían pasar
log.warn('cache-ttl-expired', { captureId: 1 });

// ERROR — fallos recuperables o no
log.error('request-failed', { captureId: 1 }, err);
// Los breadcrumbs del captureId se adjuntan automáticamente
```

> Nota de inicialización: los primeros módulos de arranque que se cargan antes de que el logger esté listo pueden usar `console.error` como fallback. Una vez inicializado `LogManager`, el sistema debe emitir únicamente con el logger estructurado para mantener la consistencia.

---

## 5. Plan de migración (5 fases)

### Fase 1 — Core del sistema (este PR)

**Archivos a crear:**

- `src/system/log/levels.ts`
- `src/system/log/types.ts`
- `src/system/log/breadcrumbs.ts`
- `src/system/log/Logger.ts`
- `src/system/log/LogManager.ts`
- `src/system/log/transports/outputChannel.ts`
- `src/system/log/transports/file.ts`
- `src/system/log/index.ts`

**Pruebas:**

- `tests/system/log/Logger.test.ts`
- `tests/system/log/LogManager.test.ts`
- `tests/system/log/transports/outputChannel.test.ts`
- `tests/system/log/transports/file.test.ts`
- `tests/system/log/breadcrumbs.test.ts`
- **Recomendado:** tests de **cola** (no bloqueo del caller) y de **fallo de escritura** (contador / degradación sin crash).

**Dependencias:** Ninguna externa (solo VS Code API para OutputChannel y FileSystem). Valorar API `createOutputChannel(..., { log: true })` según `engines.vscode` del manifest (§3.2).

---

### Fase 2 — Reemplazar `SuggestionDebug.ts` (puntos de emisión host)

| Call site                                                                                                                                                                  | Reemplazo                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/suggest/runSuggest.ts` — `logSuggestionDebug` en: `request-start`, `request-discarded`, `request-success`, `request-empty`, `request-error`, `request-cancelled` | `log.info` / `log.warn` / `log.error` según severidad del evento; mismo `captureId` en `data`                                          |
| `src/destinations/vsOpenCodeX/vsOpenCodeXDestination.ts` — `vsopencodex-inline-forward-failed`                                                                             | `log.error(...)`                                                                                                                       |
| `src/api/protocols/inboundHandlers.ts` — `logDebugInfo`                                                                                                                    | `log.debug(...)`                                                                                                                       |
| `src/ui/provider/MiniInputViewProvider.ts` — `logDebugInfo` (3)                                                                                                            | `log.debug(...)`                                                                                                                       |
| `src/extension/extension.ts` — toggle / `ensureSuggestionDebugChannel`                                                                                                     | Registrar `LogManager`, transports y `dispose` en `deactivate()`; mapear comando **Toggle debug** a nivel `debug` o flag shim según §6 |

**Nota:** En el código actual **no** hay `logSuggestionDebug` para `request-cache-hit` ni `request-blocked` en `runSuggest`; si se reintroducen desde `system/policies` u motores, usar el mismo logger con `module` explícito.

**OpenCode perf (`logOpenCodePerfCapture` / `logOpenCodeDebug`):** hoy solo están definidos en `SuggestionDebug.ts` y **no tienen call sites en `src/engines`** — decidir en esta fase: (a) eliminar como muertos en cleanup, o (b) reexpresar como `log.debug('opencode-perf', { captureId, stage, deltaMs })` cuando el motor vuelva a necesitar trazas. Los tests `logOpenCodePerfCapture.test.ts` deben apuntar al API final elegido.

**Archivos a eliminar (tras migrar):**

- `src/system/debug/SuggestionDebug.ts`

**Pruebas a actualizar:**

- `tests/logOpenCodePerfCapture.test.ts` → adaptar al nuevo Logger (o eliminar si se retira la API)
- `tests/MiniInputViewProvider.test.ts` → actualizar mocks
- `tests/host/ghostPromptSuggestPipeline.test.ts` → actualizar mocks

---

### Fase 3 — Reemplazar SuggestionLog.ts + ConversationLog.ts (2 call sites)

- **`src/api/protocols/inboundHandlers.ts`** → `handleGhostPromptInboundAccept()` (`appendSuggestion`): `log.info("suggestion-accepted", { context, suggestion })` y FileTransport (NDJSON + Markdown).
- **`src/api/protocols/inboundHandlers.ts`** → `handleGhostPromptInboundSend()` (`appendLog`): `log.info("prompt-sent", { prompt })` y FileTransport (NDJSON + Markdown).

**Archivos a eliminar:**

- `src/system/log/SuggestionLog.ts`
- `src/system/log/ConversationLog.ts`

**Migración de datos existentes (best-effort, no bloqueante):**

- Objetivo: no retrasar el release por parsers frágiles de markdown libre.
- En la primera activación post-actualización, **intentar** leer `suggestions.md` y `conversation.md` y volcar líneas o bloques reconocibles como entradas iniciales en `events.ndjson` (o un único `log.info('legacy-import', …)` por fichero si no hay parseo fiable).
- Persistir un flag **migrado** para no repetir; si el parseo falla, **continuar sin migración** (archivos legacy se pueden dejar en sitio para lectura manual).

---

### Fase 4 — Reemplazar console.\* en host (5 calls)

- **`src/api/protocols/webviewProtocols.ts`:** 3 llamadas (`console.warn` × 2, `console.error` × 1) → `log.warn` / `log.error`.
- **`src/core/memory/activate.ts`:** 2 × `console.error` → `log.error`.

> Nota: los primeros módulos cargados antes de la inicialización del logger pueden seguir usando `console.error` como fallback de bootstrap. Después de inicializar `LogManager`, el flujo de logging debe estabilizarse en el logger estructurado.

---

### Fase 5 — Cleanup

- Tras Fase 2: retirar o sustituir **`logOpenCodeDebug()`** y **`logOpenCodePerfCapture()`** según la decisión tomada (código muerto vs `log.debug` estructurado).
- Confirmar eliminación de `SuggestionDebug.ts`, `SuggestionLog.ts`, `ConversationLog.ts` si ya no hay imports.
- Actualizar `Docs/Owners.md` con los nuevos módulos.
- Actualizar `src/system/README.md` (canal **GhostPrompt Log**, cola FileTransport, `LogLevelName`).

**NO se toca en esta fase:**

- `console.*` en webview React (11 calls en `useGhostPrompt.ts` y `ErrorBoundary.tsx`) — se aborda separadamente con un transporte que use `postMessage` al host.
- `verifyWebviewBundle.ts` — build-only, fuera del VSIX.

---

## 6. Configuración

Nueva setting `ghostPrompt.logLevel` (control principal de ruido en OutputChannel y, si aplica, filtrado previo a fichero). Convive con el shim `ghostPrompt.debugSuggestions` (§2.1 y párrafos siguientes en este §6).

```json
{
  "ghostPrompt.logLevel": {
    "type": "string",
    "enum": ["debug", "info", "warn", "error"],
    "default": "info",
    "markdownDescription": "Nivel mínimo de log. `debug` muestra todo (incluye detalle fino del pipeline), `error` solo errores."
  }
}
```

`ghostPrompt.debugSuggestions` se mantiene como **compatibility shim** (precedencia detallada en §2.1):

- Si está `true` y **`ghostPrompt.logLevel` no está fijado por el usuario**, el comportamiento efectivo es el de nivel **debug** (ver todo lo que el código emite como `DEBUG`).
- Si el usuario define **`ghostPrompt.logLevel` explícitamente**, ese valor **manda**; el shim no lo sobrescribe.
- El comando **Toggle suggestion debug** puede seguir alternando el shim booleano y, en paralelo, ajustar el nivel mostrado al OutputChannel según producto — documentar el comportamiento exacto en `package.json`.

El driver principal del sistema sigue siendo **`logLevel`** + la severidad elegida en cada call site (`info` / `warn` / `error` / `debug`).

---

## 7. Setting del FileTransport

```json
{
  "ghostPrompt.logFileEnabled": {
    "type": "boolean",
    "default": true,
    "markdownDescription": "Cuando está activo, GhostPrompt persiste logs estructurados (NDJSON + Markdown) en almacenamiento global."
  },
  "ghostPrompt.logFileMaxBytes": {
    "type": "number",
    "default": 5242880,
    "minimum": 1048576,
    "maximum": 104857600,
    "markdownDescription": "Tamaño máximo del archivo NDJSON antes de rotación (bytes)."
  }
}
```

---

## 8. Árbol de archivos resultante

```text
src/system/log/
├── levels.ts
├── types.ts
├── breadcrumbs.ts
├── Logger.ts
├── LogManager.ts
├── transports/
│   ├── outputChannel.ts
│   └── file.ts
├── index.ts

tests/system/log/
├── Logger.test.ts
├── LogManager.test.ts
├── breadcrumbs.test.ts
├── transports/
│   ├── outputChannel.test.ts
│   └── file.test.ts

{globalStorageUri}/ghostPrompt/logs/v1/
├── events.ndjson              ← Activo (streaming)
├── events.2026-05-14.ndjson.gz  ← Rotado
└── session.md                 ← Sesión actual (append)
```

---

## 9. Criterios de aceptación

1. ✅ Todos los `logSuggestionDebug()`, `logDebugInfo()`, `appendSuggestion()`, y `append()` existentes son reemplazados por llamadas al nuevo Logger.
2. ✅ `events.ndjson` contiene un JSON por línea con la estructura completa de `LogEntry` (`level` como `LogLevelName` string).
3. ✅ `session.md` contiene el mismo contenido en formato legible con secciones por sesión.
4. ✅ Errores llevan breadcrumbs de su `captureId` (últimos 20 eventos) y **`flushCapture`** se ejecuta en el flujo `suggest` (p. ej. `finally`).
5. ✅ OutputChannel se crea bajo demanda con el nivel correcto y se `dispose()` en `deactivate()`.
6. ✅ Migración **best-effort** desde `suggestions.md` / `conversation.md` (flag “migrado”; fallo de parseo no bloquea el arranque); FileTransport es la fuente nueva de verdad en disco bajo `logs/v1/`.
7. ✅ Fallos de I/O del FileTransport son **visibles** (contador, `log.warn`/`console.error` de último recurso), no silenciados.
8. ✅ El hot path de `runSuggest` **no hace `await`** a escritura en disco por cada log (cola §3.4).
9. ✅ Settings `ghostPrompt.logLevel` y `ghostPrompt.debugSuggestions` (shim, §2.1 / §6) funcionan según precedencia acordada.
10. ✅ Tests unitarios para Logger, LogManager, breadcrumbs y ambos transports.
11. ✅ TypeScript strict: `--noEmit` pasa sin errores.
12. ✅ Tests existentes pasan con los mocks actualizados.

---

## 10. Prioridades de implementación

| Fase  | Descripción                                                                | Depende de | Esfuerzo est. |
| ----- | -------------------------------------------------------------------------- | ---------- | ------------- |
| **1** | Core: Logger, LogManager, transports, cola §3.4                            | —          | ⭐⭐⭐        |
| **2** | SuggestionDebug → Logger (`runSuggest`, destinos, inbound, provider, ext.) | Fase 1     | ⭐⭐          |
| **3** | SuggestionLog + ConversationLog (2 call sites)                             | Fase 1     | ⭐            |
| **4** | `console.*` en host (5 calls)                                              | Fase 1     | ⭐            |
| **5** | Cleanup + docs                                                             | Fases 2-4  | ⭐            |

---

## 11. Historial de revisiones del plan

| Fecha      | Cambios (resumen)                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-14 | Alineación v0.6+ (`runSuggest`), `LogLevelName`, `flushCapture`, I/O visible, cola FileTransport (§3.4), migración legacy best-effort, canal renombrado, precedencia settings, rutas en fases, OpenCode perf TBD. |
