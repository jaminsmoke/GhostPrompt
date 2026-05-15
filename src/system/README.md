# `system/` — Infraestructura transversal

> Dominio canónico que contiene herramientas de infraestructura compartidas por todo el sistema: debug, logs, contratos y build verification.

---

## Rol

`system/` agrupa la **infraestructura transversal** que no pertenece a un dominio de negocio específico. Son servicios utilitarios que cualquier otro dominio puede consumir sin crear acoplamiento circular.

**No debe contener:**

- Lógica del **pipeline suggest activo** (`core/suggest/runSuggest` y routing a motores)
- Protocolos de mensajes (eso es `api/`)
- Integración con VS Code providers (eso es `vscode/`)

---

## Estructura

```text
system/
├── log/
│   ├── breadcrumbs.ts
│   ├── emitContract.ts
│   ├── index.ts
│   ├── levels.ts
│   ├── Logger.ts
│   ├── LogManager.ts
│   ├── types.ts
│   └── transports/
│       ├── file.ts
│       └── outputChannel.ts
├── contracts/
│   └── webviewMessageSchemas.ts # Schemas Zod canónicos host ↔ webview
├── policies/
│   └── SuggestionRequestGovernor.ts  # Legacy: límites/caché; no en hot path suggest
└── build/
    └── verifyWebviewBundle.ts   # Verificación del bundle webview en CI/dev
```

---

## `log/LogManager.ts`

- Gestiona el singleton de logging estructurado.
- Centraliza la creación de transports, el filtro de niveles y el lifecycle de logs.
- Expone funciones públicas como `getLogger()`, `toggleSuggestionDebug()`, `isSuggestionDebugEnabled()`, `ensureSuggestionDebugChannel()`, `flushLogCapture()` y `disposeGhostPromptLogging()`.
- Conecta `ghostPrompt.logLevel` y el shim `ghostPrompt.debugSuggestions` para controlar el nivel efectivo.

### Funciones principales

| Función                          | Rol                                                                       |
| -------------------------------- | ------------------------------------------------------------------------- |
| `getLogger(moduleName)`          | Devuelve un logger por módulo con `module` estable en `LogEntry`          |
| `toggleSuggestionDebug()`        | Alterna el shim `debugSuggestions` y abre el canal de salida si se activa |
| `isSuggestionDebugEnabled()`     | Comprueba el estado del shim y la configuración efectiva                  |
| `ensureSuggestionDebugChannel()` | Crea el canal de salida `GhostPrompt Log` bajo demanda                    |
| `flushLogCapture(captureId)`     | Vacía el buffer de breadcrumbs asociado a un `captureId`                  |
| `disposeGhostPromptLogging()`    | Cierra transports y libera el singleton                                   |

---

## `log/transports`

### `outputChannel.ts`

- Transporte VS Code OutputChannel.
- Canal visible: **`GhostPrompt Log`**.
- Formatea cada `LogEntry` como línea legible.
- No persiste en disco, pero es útil para depuración en vivo.

### `file.ts`

- Transporte de almacenamiento persistente.
- Persiste eventos como `events.ndjson` y mantiene un `session.md` legible.
- Usa cola asíncrona para no bloquear el hot path.
- Soporta rotación de archivos y backpressure de `DEBUG`.

---

## `log/breadcrumbs.ts`

- Almacena un anillo FIFO de breadcrumbs por `captureId`.
- Adjunta migajas solo en eventos `WARN`/`ERROR`.
- Se limpia con `flushLogCapture(captureId)` cuando el pipeline termina.

---

## `log/Logger.ts`

- API por módulo para `debug()`, `info()`, `warn()` y `error()`.
- Cada método delega en el sink central, manteniendo `module` inmutable.
- `error()` acepta un `cause` opcional para serializar la información del error.

---

## `log/index.ts`

- Barrel público del sistema de log.
- Exporta tipos y utilidades desde `levels.ts`, `types.ts`, `breadcrumbs.ts`, `Logger.ts` y `LogManager.ts`.

---

## `build/verifyWebviewBundle.ts`

Script de verificación CI/dev que:

1. Lee `src/ui/webview/dist/react/index.html`
2. Verifica que existe y tiene contenido (>0 bytes)
3. Loguea el tamaño del bundle

**No se incluye en el VSIX** (excluido via `.vscodeignore`).

---

## Dependencias

| Subdominio   | Importa de   |
| ------------ | ------------ |
| `log/`       | `vscode`, FS |
| `contracts/` | `zod`        |
| `build/`     | Node `fs`    |

## `contracts/webviewMessageSchemas.ts`

**Single source of truth** para los contratos de mensajes entre webview y host.

### Schemas Zod

| Schema                                  | Rol                                   |
| --------------------------------------- | ------------------------------------- |
| `webviewInboundMessageSchema`           | Valida mensajes webview→host          |
| `webviewOutboundSettingsEnvelopeSchema` | Valida envelope settings host→webview |
| `suggestionModelDescriptorSchema`       | Valida descriptor de modelo           |
| `webviewUpdateSettingSchema`            | Valida `updateSetting` messages       |
| `webviewSettingsPayloadSchema`          | Valida payload de settings            |

### Tipos inferidos

| Tipo                     | Descripción                         |
| ------------------------ | ----------------------------------- |
| `WebviewInboundMessage`  | Union de todos los mensajes inbound |
| `WebviewSettingsPayload` | Payload del envelope settings       |

---

## Tests relevantes

| Test                                             | Qué cubre                 |
| ------------------------------------------------ | ------------------------- |
| `shared/webviewMessageSchemas.test.ts`           | Validación de schemas Zod |
| `logOpenCodePerfCapture.test.ts`                 | Logging de perf capture   |
| `host/ghostPromptWebviewInboundHandlers.test.ts` | Uso de logs en handlers   |
