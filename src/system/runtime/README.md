# `system/runtime/` — Orquestación host

> Pipelines que conectan webview, engines y estado mutable del host.

---

## Estructura

```text
runtime/
├── suggest/
│   ├── suggestPipeline.ts              # Pipeline `suggest` (LM + broadcast UI)
│   ├── suggestionRequestCoordinator.ts
│   ├── finalizeEngineCompletionResult.ts
│   └── lastEffectiveSuggestionModel.ts
├── providers/
│   ├── providerStatusManager.ts
│   └── createProviderErrorRecord.ts
├── testing/
│   └── resetHostRuntimeForTests.ts
└── simpleEventEmitter.ts
```

---

## Imports canónicos

| Módulo | Ruta |
| --- | --- |
| Pipeline suggest | `system/runtime/suggest/suggestPipeline` |
| Post-procesado LM | `system/runtime/suggest/finalizeEngineCompletionResult` |
| Coordinator / capture | `system/runtime/suggest/suggestionRequestCoordinator` |
| Modelo efectivo (settings) | `system/runtime/suggest/lastEffectiveSuggestionModel` |
| Estado proveedores | `system/runtime/providers/providerStatusManager` |
| Errores de proveedor | `system/runtime/providers/createProviderErrorRecord` |
| Reset tests | `system/runtime/testing/resetHostRuntimeForTests` |

---

## Tests

| Archivo | Cubre |
| --- | --- |
| `suggest/suggestPipeline.test.ts` | Pipeline de suggestion |
| `suggest/finalizeEngineCompletionResult.test.ts` | Post-procesado sugerencia cruda → UI |
| `suggest/suggestionRequestCoordinator.test.ts` | Cancelación y capture obsoleto |
| `suggest/lastEffectiveSuggestionModel.test.ts` | Modelo efectivo en settings |
| `providers/providerStatusManager.test.ts` | Estado de proveedores LM |
| `providers/createProviderErrorRecord.test.ts` | Registro de error de proveedor |
