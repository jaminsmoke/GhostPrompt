# OpenCode — checklist antes de publicar

Objetivo: no depender solo de tests unitarios (OpenCode está **mockeado** en CI estándar).

## Siempre (sin CLI)

1. `npm run check` — lint, circular deps, compile, webview bundle, Vitest unitario.

## Si el release toca motor OpenCode (`opencode/*`, catálogo, sesión, LM)

En una máquina con **`opencode --version`** OK y proveedores/modelos configurados:

```powershell
$env:GHOST_PROMPT_OPENCODE_INTEGRATION = "1"
npm run test:integration
```

Opcional — modelo explícito:

```powershell
$env:GHOST_PROMPT_OPENCODE_MODEL = "providerID/modelID"
npm run test:integration
```

Suite: [`tests/opencodeSuggestions.integration.test.ts`](../../tests/opencodeSuggestions.integration.test.ts).

## GitHub Actions

| Workflow | Cuándo |
|----------|--------|
| **`ci.yml`** | Push/PR a `main` — `npm run check` (sin OpenCode). |
| **`opencode-integration.yml`** | Solo **manual** (`workflow_dispatch`). Falla si no hay `opencode` en el PATH del runner; usar **runner self-hosted** con CLI instalado o ejecutar integración **local** arriba. |

No se ejecuta integración OpenCode en cada PR de forma automática (dependencias externas y coste).

Hay que mejorar el sistema de timeout de las suggestions.
También hay que exponer un comando o api clara para cancelar el pipeline de generación si es que no lo tenemos ya.
