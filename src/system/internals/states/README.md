# `system/internals/states/` — Estados internos del programa

> Módulo canónico para todos los estados que gestiona GhostPrompt durante su ciclo de vida.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `loading.ts` | Fases de loading (`copilot`, `ollama-generating`, etc.) y mapping a textos de UI |
| `session.ts` | Estado de sesión compartido (draft, suggestions, prompts, captureId, token de cancelación) |
| `provider.ts` | ProviderStatusManager — registro, refresh, start/stop de engines y destinations |
| `provider-types.ts` | Types de provider: `ProviderKind`, `ProviderState`, `ProviderStateRecord`, `ProviderStatusModule` |
| `register-modules.ts` | Función `registerAllProviderModules()` para registrar todos los módulos de estado |

---

## Tests

| Archivo | Descripción |
|---|---|
| `loading.test.ts` | Fases de loading y textos de UI |
| `session.test.ts` | Session store: patchState, subscribe, prepareSuggestionRequest, multi-vista |
| `provider.test.ts` | ProviderStatusManager: register, refreshAll, start, stop, errores |
