# `system/` — Infraestructura transversal

> Dominio canónico que contiene herramientas de infraestructura compartidas por todo el sistema: debug, logs, contratos y build verification.

---

## Rol

`system/` agrupa la **infraestructura transversal** que no pertenece a un dominio de negocio específico. Son servicios utilitarios que cualquier otro dominio puede consumir sin crear acoplamiento circular.

**No debe contener:**
- Lógica de suggestion (eso es `core/`)
- Protocolos de mensajes (eso es `api/`)
- Integración con VS Code providers (eso es `vscode/`)

---

## Estructura

```
system/
├── debug/
│   └── SuggestionDebug.ts       # Toggle debug, output channel, perf logging
├── log/
│   ├── ConversationLog.ts       # conversation.md: prompts enviados al chat
│   └── SuggestionLog.ts         # suggestions.md: suggestions aceptadas con Tab
├── contracts/
│   └── webviewMessageSchemas.ts # Schemas Zod canónicos host ↔ webview
└── build/
    └── verifyWebviewBundle.ts   # Verificación del bundle webview en CI/dev
```

---

## `debug/SuggestionDebug.ts`

### Output Channel

Canal **GhostPrompt Suggestions** (`vscode.window.createOutputChannel`).

### Funciones

| Función | Rol |
|---------|-----|
| `toggleSuggestionDebug()` | Activa/desactiva debug via `ghostPrompt.debugSuggestions` |
| `isSuggestionDebugEnabled()` | Check si debug está activo |
| `logSuggestionDebug(captureId, stage, detail)` | Log con prefijo `[capture:...]` |
| `logOpenCodePerfCapture(captureId, stage, deltaMs)` | Log con prefijo `[opencode-perf]` |

### Stages de debug

| Stage | Cuándo se emite |
|-------|-----------------|
| `request-start` | Inicio del request al LM |
| `request-success` | Respuesta exitosa del LM |
| `request-empty` | LM no devolvió suggestion |
| `request-error` | Error en el request |
| `request-cache-hit` | Cache hit del governor |
| `request-blocked` | Request bloqueado por governor |
| `request-discarded` | Stale o cancelado |
| `request-cancelled` | Catch-all de error |

### Perf capture (OpenCode)

| Prefijo | Métrica |
|---------|---------|
| `providers` | Snapshot de proveedores (cache o red) |
| `providers-network-fetch-ms` | Tiempo de fetch de red |
| `session-create` | Creación de nueva sesión |
| `prompt` | Round-trip del prompt |
| `stream-first-delta` | Primer delta SSE |
| `sse-consumer-settled` | Consumidor SSE completado |
| `opencode-lm-total` | Total del LM |

---

## `log/ConversationLog.ts`

- **Archivo:** `conversation.md` bajo `storageUri` (o `globalStorageUri` si no hay workspace)
- **Formato:** Markdown con timestamps
- **Contenido:** Cada prompt enviado al chat con fecha/hora

---

## `log/SuggestionLog.ts`

- **Archivo:** `suggestions.md` bajo `storageUri` (o `globalStorageUri` si no hay workspace)
- **Formato:** Markdown con timestamps
- **Contenido:** Cada suggestion aceptada con Tab, contexto y texto

---

## `contracts/webviewMessageSchemas.ts`

**Single source of truth** para los contratos de mensajes entre webview y host.

### Schemas Zod

| Schema | Rol |
|--------|-----|
| `webviewInboundMessageSchema` | Valida mensajes webview→host |
| `webviewOutboundSettingsEnvelopeSchema` | Valida envelope settings host→webview |
| `suggestionModelDescriptorSchema` | Valida descriptor de modelo |
| `webviewUpdateSettingSchema` | Valida `updateSetting` messages |
| `webviewSettingsPayloadSchema` | Valida payload de settings |

### Tipos inferidos

| Tipo | Descripción |
|------|-------------|
| `WebviewInboundMessage` | Union de todos los mensajes inbound |
| `WebviewSettingsPayload` | Payload del envelope settings |

---

## `build/verifyWebviewBundle.ts`

Script de verificación CI/dev que:
1. Lee `src/ui/webview/dist/react/index.html`
2. Verifica que existe y tiene contenido (>0 bytes)
3. Loguea el tamaño del bundle

**No se incluye en el VSIX** (excluido via `.vscodeignore`).

---

## Dependencias

| Subdominio | Importa de |
|------------|------------|
| `debug/` | `vscode` |
| `log/` | `vscode`, FS |
| `contracts/` | `zod` |
| `build/` | Node `fs` |

---

## Tests relevantes

| Test | Qué cubre |
|------|-----------|
| `shared/webviewMessageSchemas.test.ts` | Validación de schemas Zod |
| `logOpenCodePerfCapture.test.ts` | Logging de perf capture |
| `host/ghostPromptWebviewInboundHandlers.test.ts` | Uso de logs en handlers |
