# Sistema de Logging Unificado

> Roadmap v0.5 — Fase sistema de log
> Objetivo: Reemplazar los 4 mecanismos de logging dispersos por un sistema único, estructurado y extensible.

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

```
src/system/log/
├── levels.ts                    → LogLevel enum (ERROR=0, WARN=1, INFO=2, DEBUG=3)
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

```ts
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}
```

- Cada nivel incluye todos los inferiores (ERROR ve todo, DEBUG solo ve DEBUG).
- El nivel mínimo se configura vía `ghostPrompt.logLevel` (default: `"info"`).
- Cuando `ghostPrompt.debugSuggestions` está en `true`, se fuerza a `DEBUG` (compatibilidad hacia atrás).

**Futuro (post-v0.5):** Se puede añadir `METRICS` como nivel 4, filtrable independientemente.

### 2.2 LogEntry (estructura canónica)

```ts
interface LogEntry {
  timestamp: string; // ISO 8601
  level: keyof typeof LogLevel; // "ERROR" | "WARN" | "INFO" | "DEBUG"
  module: string; // e.g. "pipeline", "inbound", "vsOpenCodeX", "memory"
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
  level: keyof typeof LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
```

Ring buffer en `LogManager`:

- Máximo 20 breadcrumbs por `captureId` activo (evicción FIFO).
- En cada llamada a `log.error()` o `log.warn()`, se adjuntan los breadcrumbs del `captureId`.
- `flushCapture(captureId)` libera el buffer cuando el pipeline termina (success, error o cancel).

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

- Escribe al canal `"GhostPrompt Log"`.
- Formato por línea: `[HH:MM:SS.mmm] [LEVEL] [module] message | {data}`
- Si hay error, incluye `| {name}: {message}` y expande stack en debug.
- Nivel mínimo respeta `ghostPrompt.logLevel`.

### 3.3 FileTransport (dual format)

- Directorio base: `{globalStorageUri}/ghostPrompt/logs/v1/`
- Escribe **en cada llamada a `write()`** dos archivos simultáneamente:

| Archivo         | Formato                             | Propósito                                            |
| --------------- | ----------------------------------- | ---------------------------------------------------- |
| `events.ndjson` | NDJSON (una línea = un JSON válido) | Parseable por máquina, pipeline de telemetría futura |
| `session.md`    | Markdown con secciones por sesión   | Lectura humana directa                               |

Ejemplo `events.ndjson`:

```json
{"timestamp":"2026-05-14T10:30:00.000Z","level":"INFO","module":"pipeline","message":"request-start","captureId":1,"data":{"chars":42,"source":"copilot"}}
{"timestamp":"2026-05-14T10:30:01.200Z","level":"INFO","module":"pipeline","message":"request-success","captureId":1,"data":{"suggestionChars":38,"model":"gpt-4o-mini"}}
```

Ejemplo `session.md`:

```markdown
# GhostPrompt Log — 2026-05-14

## Sesión 2026-05-14T10:30:00.000Z

### INFO pipeline request-start

captureId=1 chars=42 source=copilot

### INFO pipeline request-success

captureId=1 suggestionChars=38 model=gpt-4o-mini
```

**Rotación:** Cuando `events.ndjson` supera 5 MB, se comprime a `events.2026-05-14.ndjson.gz` y se crea uno nuevo.

---

## 4. Uso en cada módulo

### 4.1 Obtener logger

```ts
// Cada módulo pide un logger al inicio
const log = getLogger('pipeline');
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

**Dependencias:** Ninguna externa (solo VS Code API para OutputChannel y FileSystem).

---

### Fase 2 — Reemplazar SuggestionDebug.ts (9 call sites host)

| Call site                                                                                                                                                                              | Reemplazo                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `suggestPipeline.ts` (8 calls: `request-start`, `request-success`, `request-cache-hit`, `request-blocked`, `request-discarded`, `request-empty`, `request-error`, `request-cancelled`) | `log.info(...)` / `log.warn(...)` / `log.error(...)` |
| `vsOpenCodeXDestination.ts` (1 call: `vsopencodex-inline-forward-failed`)                                                                                                              | `log.error(...)`                                     |
| `inboundHandlers.ts` (1 call: `logDebugInfo`)                                                                                                                                          | `log.debug(...)`                                     |
| `MiniInputViewProvider.ts` (3 calls: `logDebugInfo`)                                                                                                                                   | `log.debug(...)`                                     |
| `extension.ts` (setup condicional)                                                                                                                                                     | Configurar LogManager en `activate()`                |

**Archivos a eliminar:**

- `src/system/debug/SuggestionDebug.ts` (todo su contenido migrado)

**Pruebas a actualizar:**

- `tests/logOpenCodePerfCapture.test.ts` → adaptar al nuevo Logger
- `tests/MiniInputViewProvider.test.ts` → actualizar mocks
- `tests/host/ghostPromptSuggestPipeline.test.ts` → actualizar mocks

---

### Fase 3 — Reemplazar SuggestionLog.ts + ConversationLog.ts (2 call sites)

| Call site                                                                    | Reemplazo                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `inboundHandlers.ts` → `handleGhostPromptInboundAccept()` (appendSuggestion) | `log.info("suggestion-accepted", { context, suggestion })` + FileTransport escribe a ambos formatos |
| `inboundHandlers.ts` → `handleGhostPromptInboundSend()` (appendLog)          | `log.info("prompt-sent", { prompt })` + FileTransport escribe a ambos formatos                      |

**Archivos a eliminar:**

- `src/system/log/SuggestionLog.ts`
- `src/system/log/ConversationLog.ts`

**Migración de datos existentes:**

- En la primera activación post-actualización, leer `suggestions.md` y `conversation.md` y volcarlos como entrada inicial al `events.ndjson`.
- Marcar como migrado para no repetir.

---

### Fase 4 — Reemplazar console.\* en host (5 calls)

| Archivo               | Calls                                       | Reemplazo                          |
| --------------------- | ------------------------------------------- | ---------------------------------- |
| `webviewProtocols.ts` | 3 (`console.warn` × 2, `console.error` × 1) | `log.warn(...)` / `log.error(...)` |
| `memory/activate.ts`  | 2 (`console.error` × 2)                     | `log.error(...)`                   |

---

### Fase 5 — Cleanup

- Eliminar `logOpenCodeDebug()` y `logOpenCodePerfCapture()` (dead code).
- Eliminar archivos viejos: `SuggestionDebug.ts`, `SuggestionLog.ts`, `ConversationLog.ts`.
- Actualizar `Docs/Owners.md` con los nuevos módulos.
- Actualizar `src/system/README.md`.

**NO se toca en esta fase:**

- `console.*` en webview React (11 calls en `useGhostPrompt.ts` y `ErrorBoundary.tsx`) — se aborda separadamente con un transporte que use `postMessage` al host.
- `verifyWebviewBundle.ts` — build-only, fuera del VSIX.

---

## 6. Configuración

Nueva setting `ghostPrompt.logLevel` (reemplaza funcionalmente a `debugSuggestions`):

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

`ghostPrompt.debugSuggestions` se mantiene como compatibility shim:

- Si está `true`, fuerza `logLevel` a `"debug"`.
- Si se escribe `logLevel` explícitamente, respeta ese valor (el shim no sobreescribe).

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

```
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
2. ✅ `events.ndjson` contiene un JSON por línea con la estructura completa de `LogEntry`.
3. ✅ `session.md` contiene el mismo contenido en formato legible con secciones por sesión.
4. ✅ Errores llevan breadcrumbs de su `captureId` (últimos 20 eventos).
5. ✅ OutputChannel se crea bajo demanda con el nivel correcto y se `dispose()` en `deactivate()`.
6. ✅ `suggestions.md` y `conversation.md` legacy se migran una vez y luego el FileTransport toma el control.
7. ✅ Settings `ghostPrompt.logLevel` y `ghostPrompt.debugSuggestions` (shim) funcionan.
8. ✅ Tests unitarios para Logger, LogManager, breadcrumbs y ambos transports.
9. ✅ TypeScript strict: `--noEmit` pasa sin errores.
10. ✅ Tests existentes pasan con los mocks actualizados.

---

## 10. Prioridades de implementación

| Fase  | Descripción                                               | Depende de | Esfuerzo est. |
| ----- | --------------------------------------------------------- | ---------- | ------------- |
| **1** | Core del sistema (Logger, LogManager, transports)         | —          | ⭐⭐⭐        |
| **2** | Reemplazar SuggestionDebug (9 call sites)                 | Fase 1     | ⭐⭐          |
| **3** | Reemplazar SuggestionLog + ConversationLog (2 call sites) | Fase 1     | ⭐            |
| **4** | Reemplazar console.\* en host (5 calls)                   | Fase 1     | ⭐            |
| **5** | Cleanup + docs                                            | Fases 2-4  | ⭐            |
