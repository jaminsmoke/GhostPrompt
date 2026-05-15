# `system/internals/` — Estados y comportamiento interno

> Dominio de estados internos del programa GhostPrompt: loading phases, session state, provider status.
> Estos módulos representan el **estado de la aplicación** durante el ciclo de vida de la extensión,
> no la lógica de dominio de suggestions (que vive en `sugcore/`).

---

## Estructura

```text
internals/
├── states/
│   ├── loading.ts            # SuggestionLoadingPhase + statusText mapping
│   ├── session.ts            # GhostPromptSessionStore (estado compartido multi-vista)
│   ├── provider.ts           # ProviderStatusManager (registro, refresh, start/stop)
│   ├── provider-types.ts     # Types de provider (ProviderKind, ProviderState, etc.)
│   ├── register-modules.ts   # registerAllProviderModules()
│   └── README.md
└── README.md
```

---

## Qué entra aquí

- **Loading phases** (`states/loading.ts`) — textos de estado UI durante requests a modelos
- **Session state** (`states/session.ts`) — estado de sesión compartido (draft, suggestions, prompts, captureId)
- **Provider status** (`states/provider.ts` + `provider-types.ts`) — gestión de estado de engines y destinations

## Qué NO entra aquí

- Lógica de suggestions → `sugcore/`
- Logging → `system/log/`
- Protocolos webview ↔ host → `api/`
