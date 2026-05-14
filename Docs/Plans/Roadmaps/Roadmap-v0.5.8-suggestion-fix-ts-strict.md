# Roadmap v0.5.8 — Diagnóstico de sugerencias + TypeScript strict + Error Boundary

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: Diagnosticar por qué las sugerencias no llegan al host tras la migración React, mejorar el manejo de errores runtime, y endurecer la configuración de TypeScript para prevenir bugs silenciosos.

---

## Resumen

| Fase | Alcance | Resultado | Estado |
|------|---------|-----------|--------|
| Fase 1 | ErrorBoundary + try-catch en hooks | Errores runtime capturados y visibles | ⚪ No iniciado |
| Fase 2 | TypeScript strict (noUnusedLocals, noUnusedParameters) | Ambos tsconfig endurecidos | ⚪ No iniciado |
| Fase 3 | Script typecheck unificado | `npm run typecheck` verifica host + webview | ⚪ No iniciado |
| Fase 4 | Actualizar validate + bugfix debounce fallback | validate más rápido + red sanitizer | ⚪ No iniciado |
| Fase 5 | Validación final | Build + 219 tests | ⚪ No iniciado |

---

## Fase 1 — Error Boundary + try-catch

### Tareas

1. Crear `src/ui/webview/react/components/ErrorBoundary.tsx`
   - Componente de clase React que captura errores via `componentDidCatch`
   - Muestra mensaje de error visible en el webview con botón de recarga
   - Usa estilos VS Code (`var(--vscode-errorForeground)`)

2. Envolver `handleMessage` en `useGhostPrompt.ts` con try-catch:
   ```ts
   try {
     // ... message handling
   } catch (err) {
     console.error("[GP] Error en handleMessage:", err);
   }
   ```

3. Envolver `requestSuggestion`, `handleTextChange` en try-catch similar

### Criterios de aceptación

- Si un error runtime ocurre en React, se muestra en pantalla en vez de quedar silencioso
- Errores en message handling se loguean a consola

---

## Fase 2 — TypeScript strict

### Tareas

1. Agregar a `tsconfig.json` (host):
   ```json
   "noUnusedLocals": true,
   "noUnusedParameters": true,
   "noFallthroughCasesInSwitch": true
   ```

2. Agregar a `src/ui/webview/tsconfig.json`:
   ```json
   "noUnusedLocals": true,
   "noUnusedParameters": true
   ```

3. Corregir errores que surjan de estas nuevas flags

### Criterios de aceptación

- `tsc --noEmit` pasa sin errores
- `tsc --noEmit -p src/ui/webview/tsconfig.json` pasa sin errores

---

## Fase 3 — Script typecheck unificado

### Tareas

1. Agregar script en `package.json`:
   ```json
   "typecheck": "tsc --noEmit && tsc --noEmit -p src/ui/webview/tsconfig.json"
   ```

### Criterios de aceptación

- `npm run typecheck` pasa en 0 errores

---

## Fase 4 — validate actualizado + debounce fallback

### Tareas

1. Actualizar `validate` para usar `typecheck` en vez de `compile` + `typecheck:webview` separados
   ```json
   "validate": "npm run lint && npm run deps:circular && npm run typecheck && npm run build:webview && npm run verify:webview-bundle"
   ```

2. En `useGhostPrompt.ts`, agregar sanitizer para `suggestionDebounceMs`:
   ```ts
   if (suggestionDebounceMs < 150) {
     console.warn("[GP] suggestionDebounceMs inválido (%d), usando 800", suggestionDebounceMs);
     setSuggestionDebounceMs(800);
   }
   ```

### Criterios de aceptación

- `npm run validate` pasa completo

---

## Fase 5 — Validación final

### Tareas

1. Ejecutar `npm run validate`
2. Ejecutar `npm run test`
3. Verificar 219 tests pasan

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/ui/webview/react/components/ErrorBoundary.tsx` | **Nuevo** |
| `src/ui/webview/react/App.tsx` | Envolver App en ErrorBoundary |
| `src/ui/webview/react/hooks/useGhostPrompt.ts` | try-catch en message handling + debounce sanitizer |
| `tsconfig.json` | +noUnusedLocals, +noUnusedParameters, +noFallthroughCasesInSwitch |
| `src/ui/webview/tsconfig.json` | +noUnusedLocals, +noUnusedParameters |
| `package.json` | +script typecheck, actualizar validate |
| `Docs/Plans/Roadmaps/Roadmap-v0.5.8-suggestion-fix-ts-strict.md` | **Nuevo** |
