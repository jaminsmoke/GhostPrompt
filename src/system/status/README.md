# `system/status/` — Sistema de estados de proveedores

> Proporciona un mecanismo unificado para consultar, visualizar y gestionar
> el estado de cada motor (Copilot, OpenCode, Ollama) y destino
> (CopilotChat, VSOpenCodeX) de GhostPrompt.

---

## Arquitectura

```
StatusModule (interfaz)
  ├── check()         → ProviderStateRecord
  ├── start() (opc.)  → inicia el servicio
  └── stop() (opc.)   → detiene el servicio

ProviderStatusManager
  ├── register(mod)    → registra un módulo
  ├── refreshAll()     → checkea todos
  ├── refresh(id)      → checkea uno
  ├── start(id)        → inicia uno
  └── stop(id)         → detiene uno
```

## Estados

| Estado | Significado | Icono |
|--------|-------------|-------|
| `running` | Servicio activo y disponible | ● verde |
| `stopped` | Instalado pero no iniciado | ○ gris |
| `starting` | En proceso de arranque | ◌ animado |
| `unavailable` | No instalado o no disponible | — gris |
| `error` | Falló al comprobar estado | ● rojo |

## Módulos implementados

| Módulo | Archivo | Tipo | check() | start() | stop() |
|--------|---------|------|---------|---------|--------|
| Copilot LM | `engines/copilot/copilotStatus.ts` | engine | siempre running | — | — |
| OpenCode | `engines/opencode/opencodeStatus.ts` | engine | ping HTTP | terminal headless | POST /exit |
| Ollama | `engines/ollama/ollamaStatus.ts` | engine | `ollama --version` + `ollama list` | vía ModelManager | vía ModelManager |
| Copilot Chat | `destinations/copilotChat/copilotChatStatus.ts` | destination | siempre running | — | — |
| VSOpenCodeX | `destinations/vsOpenCodeX/vsOpenCodeXStatus.ts` | destination | `extensions.getExtension()` | — | — |

## Flujo de mensajes (host ↔ webview)

```
Webview                     Host
  │                          │
  ├─ requestProviderStatus ─→│
  │                          ├─ refreshAll()
  │                          ├─ providerStatus(providers)
  │←────────────────────────┤
  │                          │
  ├─ startProvider(id) ────→│
  │                          ├─ mod.start()
  │                          ├─ refresh(id)
  │                          ├─ providerStatus(providers)
  │←────────────────────────┤
  │                          │
  ├─ stopProvider(id) ─────→│
  │                          ├─ mod.stop()
  │                          ├─ refresh(id)
  │                          ├─ providerStatus(providers)
  │←────────────────────────┤
```

## Tests

| Archivo | Cubre |
|---------|-------|
| `tests/ProviderStatusManager.test.ts` | register, refreshAll, start, stop, errores |
| `tests/copilotStatus.test.ts` | estado running |
| `tests/ollamaStatus.test.ts` | CLI mocking (--version, list) |
| `tests/opencodeStatus.test.ts` | HTTP ping, start, stop |
| `tests/vsOpenCodeXStatus.test.ts` | detección de extensión |
