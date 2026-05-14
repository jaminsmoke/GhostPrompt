# Issues encontrados — v0.5.5

> Hallazgos de integración, consistencia y cobertura tras la introducción masiva de JSDoc.
> Auditoría: 2026-05-14

---

## 🔴 CRITICAL — Bugs activos

### 1. Mock paths rotos en tests de VSOpenCodeX — solved

**Archivos:**
- `tests/vsOpenCodeXDestination.test.ts:32`
- `tests/vsOpenCodeXGhostPromptUiBridge.test.ts:8`

**Problema:** Ambos hacen `vi.mock("../src/debug/SuggestionDebug", ...)` pero esa ruta **no existe**. El módulo real está en `src/system/debug/SuggestionDebug.ts`. Vitest no lanza error por mockear rutas inexistentes — el mock se convierte en un agujero negro que nunca intercepta las importaciones reales.

**Estado:** Solucionado. Se actualizó el mock a `../src/system/debug/SuggestionDebug` en ambos tests.

**Código fuente afectado:** `src/destinations/vsOpenCodeX/vsOpenCodeXDestination.ts:2` importa desde `../../system/debug/SuggestionDebug`, que es una ruta distinta a la del mock.

**Por qué los tests "pasan":** `logSuggestionDebug` es no-op cuando `ghostPrompt.debugSuggestions` es `false` (default), y el mock de `vscode.commands.executeCommand` siempre resuelve exitosamente, así que el `catch` donde se llama `logSuggestionDebug` nunca se ejecuta. Los tests pasan por casualidad, no por correcto aislamiento.

**Riesgo:** Si se refactoriza `forwardGhostPromptInlineUiToVsOpenCodeIfApplicable` para llamar a `logSuggestionDebug` en un path no-error, los tests fallarán sin relación con el cambio.

**Fix:** Cambiar a `vi.mock("../../src/system/debug/SuggestionDebug", ...)` en ambos archivos.

---

### 2. Mensaje `languageEffective` — schema, host y webview desincronizados — solved

**Host envía** (`src/core/pipeline/suggestPipeline.ts:220-223`):
```ts
deps.broadcastUi({
  type: "languageEffective",
  language: effectiveLanguage,  // <-- campo 'language'
});
```

**Schema Zod** (`src/system/contracts/webviewMessageSchemas.ts:115-119`):
```ts
export const webviewOutboundLanguageEffectiveSchema = z.object({
  type: z.literal("languageEffective"),
  language: z.enum(["es", "en"]),
  captureId: z.number().optional(),
  broadcast: z.boolean().optional(),
});
```

**Webview React types** (`src/ui/webview/react/types.ts`):
- El discriminated union `InboundMessage` ahora incluye la variante `languageEffective`
- El handler en `useGhostPrompt.ts` reconoce el mensaje y ya no lo ignora silenciosamente

**Por qué pasa Zod:** El schema no contenía el campo `language`, así que el mensaje era validado como inválido y desincronizado respecto al host.

**Impacto:** La UI ya puede recibir correctamente el cambio de idioma efectivo. Se corrigió el schema y el tipo del mensaje.

---

## 🟡 MEDIUM — Riesgos de mantenimiento

### 3. `parseWebviewOutboundMessage` — return value descartado

**Archivo:** `src/ui/provider/MiniInputViewProvider.ts:106`

```ts
private static _broadcastUi(payload: Record<string, unknown>): void {
  const message = { ...payload, broadcast: true };
  parseWebviewOutboundMessage(message);  // ← return value ignorado
  for (const instance of MiniInputViewProvider._instances) {
    instance._view?.webview.postMessage(message);  // ← envía el original sin validar
  }
}
```

**Problema:** La validación Zod es puro side-effect (log en consola). No filtra ni transforma mensajes inválidos. Si un mensaje no pasa el schema, igual se envía al webview.

**Riesgo:** Es _validation theater_ — da la ilusión de un contrato estricto pero en la práctica no blinda nada. Cualquier drift entre schema y emisor (como el issue #2) pasa desapercibido.

**Fix propuesto:** Usar el return value: `const parsed = parseWebviewOutboundMessage(message); if (!parsed) return;` y enviar `parsed` en vez de `message`. O al menos loggear error cuando falla.

---

### 4. Cobertura incompleta de fases de loading

**Archivo:** `tests/suggestionLoadingUi.test.ts`

Se testean 8 de 12 fases. Faltan:
| Fase faltante | Source (`src/core/loading.ts`) |
|---|---|
| `ollama-checking-install` | L46 |
| `ollama-listing-models` | L48 |
| `ollama-starting-model` | L49 |
| `ollama-model-ready` | L52 |

**Impacto:** Bajo ahora, pero si alguien cambia los textos de esas 4 fases, no hay test que lo detecte.

---

### 5. Docs de arquitectura desactualizados

**Archivo:** `Docs/Plans/Roadmaps/v0.3/1.architecture.md`

Referencias a rutas que ya no existen:
- `src/debug/SuggestionDebug.ts` → movido a `src/system/debug/SuggestionDebug.ts`
- `src/governor/` → movido a `src/core/governor/`
- `src/bridge/` → eliminado o movido
- `src/log/*` → movido a `src/system/log/`

---

## 🟢 LOW — Cobertura y estilo

### 6. `completionProvider.test.ts` solo cubre el path legacy

**Archivo:** `tests/completionProvider.test.ts`

Solo mockea la clave legacy `completionProvider`. Nunca testea el path de `enabledCompletionSources`. Si la lógica de `getEnabledCompletionSources` en `src/core/sources.ts` cambia (p. ej. la detección de "explicitly configured"), estos tests no detectarían regresiones.

---

### 7. Webview types más restrictivas que Zod schema en `empty.reason`

- `src/ui/webview/react/types.ts` — `InboundMessage["empty"]["reason"]` es unión de 9 literales específicas
- `src/system/contracts/webviewMessageSchemas.ts` — `webviewOutboundEmptySchema["reason"]` es `z.string()` (acepta cualquier string)

Si se agrega un nuevo `reason` del lado host, Zod lo acepta pero el tipo en React no, causando un falso positivo de TypeScript o un `@ts-expect-error` silenciado.

---

### 8. `parseWebviewOutboundMessage` mockeado como no-op en test principal

**Archivo:** `tests/MiniInputViewProvider.test.ts:117`

```ts
parseWebviewOutboundMessage: () => undefined,
```

Esto desactiva la validación Zod en el test de integración más importante. Cualquier drift entre schema y emisor (como el issue #2) pasa inadvertido en la suite. Fix: usar el `parseWebviewOutboundMessage` real — o un spy — para que los tests también validen los mensajes salientes.

---

## Resumen de prioridades sugeridas

| # | Issue | Prioridad | Esfuerzo estimado |
|---|---|---|---|
| 1 | Mock paths rotos | 🔴 Alta | 5 min |
| 2 | `languageEffective` desincronizado | 🔴 Alta | 30 min (3 archivos) |
| 3 | Return value descartado en `_broadcastUi` | 🟡 Media | 10 min |
| 4 | Fases de loading sin test | 🟡 Media | 10 min |
| 5 | Docs desactualizados | 🟡 Media | 10 min |
| 6 | Coverage legacy-only | 🟢 Baja | 15 min |
| 7 | Tipos webview vs Zod | 🟢 Baja | 5 min |
| 8 | Mock no-op en test | 🟢 Baja | 10 min |
