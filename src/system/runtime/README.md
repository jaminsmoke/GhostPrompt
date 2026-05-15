# `system/runtime/` — Orquestación host

> Pipelines que conectan webview, engines y estado mutable del host.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `suggestRuntime.ts` | Pipeline `suggest` (LM + broadcast UI) |
| `suggestionRequestCoordinator.ts` | `captureId` activo y cancelación in-flight |
| `lastEffectiveSuggestionModel.ts` | Último modelo usado en suggestion exitosa (settings UI) |
| `providerStatusManager.ts` | Registry + refresh/start/stop de proveedores LM |
| `createProviderErrorRecord.ts` | Registro de error cuando falla `check()` |
| `resetHostRuntimeForTests.ts` | Reinicio de singletons para tests |

---

## Tests

| Archivo | Cubre |
|---|---|
| `suggestRuntime.test.ts` | Pipeline de suggestion |
| `suggestionRequestCoordinator.test.ts` | Cancelación y capture obsoleto |
| `lastEffectiveSuggestionModel.test.ts` | Modelo efectivo en settings |
| `providerStatusManager.test.ts` | Estado de proveedores LM |
| `createProviderErrorRecord.test.ts` | Registro de error de proveedor |
