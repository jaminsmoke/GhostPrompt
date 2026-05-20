# Roadmap v0.5.9 — Contratos host↔webview, validación Zod saliente y filtro de modelos

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: Robustecer la comunicación host↔webview con validación Zod de mensajes salientes, filtrar modelos por provider activo, agregar tests de integración y JSDoc en funciones críticas para evitar regresiones.

---

## Resumen

| Fase   | Alcance                                                                      | Resultado                                                                              | Estado        |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------- |
| Fase 1 | Schema Zod unificado para mensajes salientes + `parseWebviewOutboundMessage` | Todo mensaje host→webview validado                                                     | 🟢 Completado |
| Fase 2 | Filtro de `availableModels` por provider activo en `<select>`                | No aparecen modelos de Copilot cuando Ollama está activo                               | 🟢 Completado |
| Fase 3 | Tests de integración del flujo providerStatus                                | 5 tests nuevos, 243 total                                                              | 🟢 Completado |
| Fase 4 | JSDoc en funciones críticas                                                  | `_broadcastUi`, `startModel`, `handleGhostPromptInboundUpdateSetting` documentados     | 🟢 Completado |
| Fase 5 | **Integración de `parseWebviewOutboundMessage` en puntos de envío**          | Validación Zod en `_broadcastUi`, `handleGhostPromptInboundInit`, `postProviderStatus` | 🟢 Completado |

---

## Fase 1 — Validación Zod de mensajes salientes

### Tareas

1. Crear `webviewOutboundMessageSchema` en `webviewMessageSchemas.ts` como unión discriminada de todos los tipos:

```ts
export const webviewOutboundMessageSchema = z.discriminatedUnion("type", [
  webviewOutboundSettingsEnvelopeSchema,
  webviewOutboundProviderStatusSchema,
  z.object({ type: z.literal("loading"), captureId: z.number(), ... }),
  z.object({ type: z.literal("suggestion"), suggestion: z.string(), captureId: z.number(), model: suggestionModelDescriptorSchema.optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("suggestion-stream"), text: z.string(), captureId: z.number(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("empty"), reason: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("error"), message: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("clear"), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("draftHydrate"), text: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("draftSync"), text: z.string(), originViewId: z.string(), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
  z.object({ type: z.literal("languageEffective"), captureId: z.number().optional(), broadcast: z.boolean().optional() }),
]);
```

2. Crear `parseWebviewOutboundMessage()` en `webviewProtocols.ts`
3. Integrar en `_broadcastUi` y en cada `webview.postMessage` directo
4. En desarrollo, si el mensaje no pasa validación, lanzar `console.warn` con el error

### Criterios de aceptación

- Todo mensaje host→webview pasa por Zod
- Mensajes inválidos loguean warning en desarrollo
- Tests existentes siguen pasando

---

## Fase 2 — Filtro de modelos por provider activo

### Tareas

1. En `GhostToolbar.tsx`, filtrar `availableModels` antes de pasarlos al `<select>`:

```tsx
const filteredModels = useMemo(() => {
  if (completionProvider === 'ollama')
    return availableModels.filter((m) => m.completionSource === 'ollama');
  if (completionProvider === 'opencode')
    return availableModels.filter((m) => m.completionSource === 'opencode');
  return availableModels;
}, [completionProvider, availableModels]);
```

2. Usar `filteredModels` en el `<select>` de modelo y en el label del modelo activo

### Criterios de aceptación

- Con Ollama activo, solo se ven modelos Ollama en el selector
- Con Copilot activo, se ven todos (incluyendo merged si hay multi-source)
- Con OpenCode activo, solo modelos OpenCode

---

## Fase 3 — Tests de integración

### Tareas

1. Crear `tests/integration/providerStatusFlow.test.ts`:

```ts
describe("providerStatus flow", () => {
  it("envía providerStatus a ambas vistas vía broadcastUi", async () => { ... });
  it("al seleccionar Ollama, selectedModelId se resetea a ''", async () => { ... });
  it("al cambiar de provider, availableModels se filtra correctamente", async () => { ... });
  it("providerStatusManager.refreshAll captura errores de módulos", async () => { ... });
});
```

### Criterios de aceptación

- 4+ tests nuevos de integración
- Tests son deterministas (no dependen de Ollama instalado)

---

## Fase 4 — JSDoc en funciones críticas

### Tareas

Agregar JSDoc a:

1. `MiniInputViewProvider._broadcastUi` — documentar que envía a TODAS las instancias registradas y forward a VSOpenCodeX
2. `handleGhostPromptInboundUpdateSetting` — documentar efectos secundarios (reset de modelo, start/stop Ollama)
3. `ollamaModelManager.startModel` — documentar flags CLI, tiempo de espera, detección de ready
4. `ollamaModelManager.ps` — documentar parseo de `ollama ps`
5. `postProviderStatus` en `inboundHandlers.ts` — documentar que envía al webview actual + broadcast a todas

### Criterios de aceptación

- 5+ funciones con JSDoc completo (params, returns, side effects)

---

## Fase 5 — Integración de `parseWebviewOutboundMessage` en puntos de envío

### Tareas

1. En `MiniInputViewProvider._broadcastUi`: validar todo mensaje saliente con `parseWebviewOutboundMessage` antes de `webview.postMessage`
2. En `handleGhostPromptInboundInit` (`inboundHandlers.ts`): validar `draftHydrate` antes de enviar
3. En `postProviderStatus` (`inboundHandlers.ts`): validar `providerStatus` antes de enviar y broadcast

### Archivos modificados

- `src/ui/provider/MiniInputViewProvider.ts` — import + llamada a `parseWebviewOutboundMessage` en `_broadcastUi`
- `src/api/protocols/inboundHandlers.ts` — import + llamada en `handleGhostPromptInboundInit` y `postProviderStatus`
- `tests/MiniInputViewProvider.test.ts` — mock de `parseWebviewOutboundMessage` añadido

### Criterios de aceptación

- `parseWebviewOutboundMessage` se llama en los 3 puntos de envío
- Tests existentes siguen pasando (243 tests)

---

## Hitos clave

| Hito   | Objetivo                 | Criterio de éxito                                              | Estado        |
| ------ | ------------------------ | -------------------------------------------------------------- | ------------- |
| Hito 1 | Zod outbound             | Mensajes salientes validados                                   | 🟢 Completado |
| Hito 2 | Filtro modelos           | Select solo muestra modelos del provider activo                | 🟢 Completado |
| Hito 3 | Tests integración        | 5 tests nuevos, deterministas                                  | 🟢 Completado |
| Hito 4 | JSDoc crítico            | 3+ funciones documentadas                                      | 🟢 Completado |
| Hito 5 | Integración Zod en envío | `parseWebviewOutboundMessage` llamado en los 3 puntos de envío | 🟢 Completado |
