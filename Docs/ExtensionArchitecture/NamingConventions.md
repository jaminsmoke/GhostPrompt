# Convenciones de nomenclatura — GhostPrompt

> Reglas de nombres compartidas del proyecto. Este documento crece por capas; la primera sección fija **solo** los archivos bajo `src/system/internals/protocols/`.
>
> **Renombrado masivo:** los ficheros que existen hoy en `protocols/` **no cumplen** aún estas reglas. Aplicar los nuevos nombres es una **fase aparte** (migración de imports, barrels y tests), posterior a acordar la convención aquí.

---

## Protocolos (`system/internals/protocols/`)

### Rol de la capa

`protocols/` es la fuente única de **contratos puros**: tipos, constantes, validación, guards y formas de estado **declarativas**. Sin estado mutable en tiempo de ejecución, sin `vscode`, sin logging en parsers (los parsers con side effects viven en `api/boundary/` e importan esquemas desde aquí).

La **carpeta** indica la familia; el **prefijo del archivo** refuerza el rol y permite grepear (`cons*`, `zschem*`, …) sin ambigüedad.

### Prefijos de archivo (obligatorios en ficheros nuevos)

| Familia | Carpeta | Prefijo | Ejemplo de nombre |
|--------|---------|---------|-------------------|
| Constantes | `constants/` | `cons` | `consDestinations.ts` |
| Guards | `guards/` | `guard` | `guardCopilotLm.ts` |
| Estado (contratos) | `state/` | `state` | `stateLoadingPhase.ts` |
| Tipos | `types/` | `type` | `typeCompletion.ts` |
| Validación general | `validations/` (fuera de `schemas/`) | `val` | `val…` (cuando existan módulos no-Zod) |
| Esquemas Zod | `validations/schemas/` | `zschem` | `zschemWebviewMessages.ts` |

Los prefijos van en **minúsculas** y pegados al nombre de dominio en **camelCase** (sin punto, sin PascalCase en el nombre del fichero).

### Patrón de nombre

```text
<prefijo><dominioEnCamelCase>.ts
```

- **`<prefijo>`** — una de la tabla anterior (`cons`, `guard`, `state`, `type`, `val`, `zschem`).
- **`<dominioEnCamelCase>`** — tema del contrato (`ghostPromptDestinations`, `webviewMessages`, `copilotLm`, …).
- **Tests** — mismo stem + `.test.ts`: p. ej. `zschemWebviewMessages.test.ts`.
- **Barrels** — `index.ts` sin prefijo (reexportan los módulos prefijados).

### Símbolos exportados

El prefijo del **archivo** no obliga a prefijar exports con el nombre del producto (`GhostPrompt`, `GHOST_PROMPT_`). El dominio ya está en la ruta `protocols/`.

| Artefacto | Convención | Ejemplo |
|-----------|------------|---------|
| Constantes | `SCREAMING_SNAKE` | `AGENT_DESTINATION_IDS`, `OUTBOUND_UI_FORWARD_KINDS` |
| Tipos / interfaces | `PascalCase` | `AgentDestination`, `OutboundUiForwardKind` |
| Funciones puras (parse, guard) | `camelCase` | `parseAgentDestination`, `isOutboundUiForwardKind` |
| Esquemas Zod | `camelCase` + sufijo opcional `Schema` | `webviewInboundMessageSchema` |

#### Mapa PG (v0.6.1) — renombres aplicados

| Antes | Después |
|-------|---------|
| `GHOST_PROMPT_AGENT_DESTINATION_IDS` | `AGENT_DESTINATION_IDS` |
| `GHOST_PROMPT_OUTBOUND_UI_FORWARD_KINDS` | `OUTBOUND_UI_FORWARD_KINDS` |
| `VS_OPEN_CODE_X_GHOST_PROMPT_INLINE_UI` | `VS_OPEN_CODE_X_INLINE_UI_COMMAND` |
| `GhostPromptAgentDestination` | `AgentDestination` |
| `GhostPromptOutboundUiForwardKind` | `OutboundUiForwardKind` |
| `parseGhostPromptAgentDestination` | `parseAgentDestination` |
| `getGhostPromptAgentDestination` | `getAgentDestination` |
| `isGhostPromptOutboundUiForwardKind` | `isOutboundUiForwardKind` |

> Los **valores** de configuración VS Code (`ghostPrompt.*`) y IDs de comando reales (`vsopencodex.ghostPromptInlineUi`) no cambian; solo los símbolos TypeScript exportados.

### Subcarpetas

Se mantienen las familias actuales (`constants/`, `guards/`, `types/`, `state/`, `validations/schemas/`). El prefijo del archivo **no sustituye** la carpeta: `constants/consGhostPromptDestinations.ts`, no un único directorio plano salvo decisión futura explícita.

Dentro de `state/` pueden existir subcarpetas (`loading/`, `provider/`); el prefijo `state` sigue aplicando al nombre del fichero (`stateLoadingLabels.ts`).

### Qué puede ir en cada familia

| Prefijo | Contenido permitido | Contenido prohibido |
|---------|---------------------|---------------------|
| `cons` | Literales, `as const`, IDs de comando, defaults de pipeline | Lógica, I/O, imports de `vscode` |
| `guard` | Predicados y clasificadores puros sobre texto/errores | Estado mutable, side effects |
| `state` | Formas de estado del host (fases, proveedor, labels) | Mutación, stores, timers |
| `type` | Unions, interfaces, tipos de request/result; reexports estables desde `cons` | Implementación de runtime |
| `val` | Validadores no-Zod (si se añaden) | `safeParse` con logging, VS Code |
| `zschem` | Solo `z.*`, `z.infer`, tipos inferidos del wire | Parsers boundary, logging, VS Code |

### Ejemplos (estado en repo)

| Objetivo (vigente) | Contenido |
|--------------------|-----------|
| `constants/consDestinations.ts` | IDs de destino agente |
| `constants/consPipelineDefaults.ts` | `DEFAULT_*` del pipeline suggest |
| `constants/consOutboundForwardKinds.ts` | Tupla `as const` de tipos reenviables a VSX |
| `guards/guardOutboundForward.ts` | `isOutboundUiForwardKind` |
| `guards/guardCopilotLm.ts` | Heurísticas errores/refusals Copilot |
| `guards/guardBoundSuggestion.ts` | `boundSuggestionText` |
| `types/typeCompletion.ts` | `CompletionResult`, `CompletionCancellationToken`, request options, … |
| `types/typeDestinations.ts` | `DestinationId`, `AgentDestination`, `parseAgentDestination`, … |
| `state/loading/stateLoadingPhase.ts` | Fases de carga UI |
| `validations/schemas/zschemWebviewMessages.ts` | Schemas Zod host↔webview |
| `constants/consCursorChat.ts` | Comandos/prefijos de sondeo Cursor Chat |
| `types/typeCompletionUi.ts` | `CompletionUiKind`, tuplas para Zod (`COMPLETION_UI_*_VALUES`) |
| `guards/guardProviderId.ts` | `isProviderId` sobre `PROVIDER_ID_VALUES` |

### Imports recomendados

- Consumidores externos importan desde **barrels** (`protocols/types/index.ts`, `protocols/constants/index.ts`, …) cuando existan.
- Rutas directas al fichero prefijado son válidas en migraciones o tests co-localizados.
- `api/boundary/webviewProtocols.ts` importa esquemas desde `validations/schemas/zschem*.ts`, no redefine Zod en `api/`.
- En el webview React: tipos desde `ui/webview/react/types.ts`; constantes `cons*` desde `webviewProtocolConstants.ts`; schemas Zod desde `webviewProtocolSchemas.ts` (sin importar `api/` ni `system/log/`).

### Relación con otra documentación

- Estructura y familias: `src/system/internals/protocols/README.md`
- Extracción y tareas: `Docs/Plans/Roadmaps/v0.6.1/01-protocols-extraction.md`
- Árbol físico general: [`PhysicalStructure.md`](./PhysicalStructure.md)

---

## Otras capas

> Pendiente: convenciones para `api/`, `engines/`, `sugcore/`, `destinations/`, etc.
