# PA–PD — Higiene de UI webview (renderizado, errores, inicialización)

> **Objetivo:** Diagnóstico y corrección de todos los problemas de renderizado, feedback al usuario, manejo de errores, y robustez de inicialización en el webview React de GhostPrompt.
>
> **Contexto:** Auditoría completa del pipeline webview (HTML, CSP, mensajes host↔webview, React, manejo de errores, build) reveló 15 issues. CSP (corregido previamente), H1–H3 (HIGH), M1–M7 (MEDIUM), L1–L3 (LOW).

---

## Issues identificados

| ID | Severidad | Descripción | Archivo(s) |
|----|-----------|-------------|------------|
| ~~CSP~~ | ~~🔴~~ | ~~Runtime CSP perdía `'unsafe-eval'`~~ ✅ | ~~`webviewHtml.ts:115`~~ |
| **H1** | 🔴 HIGH | Sin fallback UI si React no monta | `main.tsx` |
| **H2** | 🔴 HIGH | ErrorBoundary "Reintentar" no resetea estado | `ErrorBoundary.tsx` |
| **H3** | 🔴 HIGH | `hostQuery` sin timeout ni cleanup | `utils/hostQuery.ts` |
| M1 | 🟡 MEDIUM | `localResourceRoots` expone `src/ui/webview/` entero | `MiniInputViewProvider.ts:252` |
| M2 | 🟡 MEDIUM | Vite build emite `type="module"` pese a `format:'iife'` | `vite.config.ts` / `dist/index.html` |
| M3 | 🟡 MEDIUM | Sin indicador de "cargando configuración" | `ghostPromptUiState.ts` |
| M4 | 🟡 MEDIUM | Catch blocks solo loggean, sin feedback visual | `handleGhostPromptInboundMessage.ts`, `useGhostPromptHandlers.ts` |
| M5 | 🟡 MEDIUM | Broadcast puede perderse antes de React mount listener | `useGhostPromptEffects.ts` |
| M6 | 🟡 MEDIUM | `viewId` puede ser `''` si script inline falla | `ghostPromptUiState.ts` |
| M7 | 🟡 MEDIUM | Regex asset URLs solo captura `./` prefix | `webviewHtmlTransforms.ts` |
| L1 | 🟢 LOW | Sin spinner durante descarga del bundle | `react/index.html` |
| L2 | 🟢 LOW | Regex CSP frágil | `webviewHtml.ts` |
| L3 | 🟢 LOW | `moveExternalScriptsToBodyEnd` depende de strip previo | `webviewHtmlTransforms.ts` |

---

## Fase PA — Quick hardening

| # | Issue | Cambio | Archivo |
|---|-------|--------|---------|
| A1 | M1 | Eliminar primer `localResourceRoots` (broad). Solo dejar `dist/react` | `MiniInputViewProvider.ts` |
| A2 | M7 | Ampliar regex asset URLs para capturar paths sin `./` | `webviewHtmlTransforms.ts` |
| A3 | L2 | Mover `http-equiv` al inicio del regex CSP | `webviewHtml.ts` |
| A4 | M6 | Fallback `viewId` → `'unknown'` si `__ghostPromptViewId` no es string | `ghostPromptUiState.ts` |

## Fase PB — Error resilience

| # | Issue | Cambio | Archivo |
|---|-------|--------|---------|
| B1 | H1 | Catch en `main.tsx`: fallback visible en `#root` en vez de throw | `main.tsx` |
| B2 | H2 | `handleReload` → `window.location.reload()` | `ErrorBoundary.tsx` |
| B3 | M4 | Añadir `setStatus('Error interno')` en catch blocks | `handleGhostPromptInboundMessage.ts`, `useGhostPromptHandlers.ts` |

## Fase PC — Initialization reliability

| # | Issue | Cambio | Archivo |
|---|-------|--------|---------|
| C1 | H3 | `hostQuery<T>`: timeout 15s + cleanup listener | `utils/hostQuery.ts` |
| C2 | M3 | Estado `isConfigLoaded` → skeleton/indicador hasta `settings` | `ghostPromptUiState.ts`, `App.tsx` |
| C3 | M5 | Buffer `pendingMessages[]` pre-mount, drain al montar listener | `useGhostPromptEffects.ts`, `handleGhostPromptInboundMessage.ts` |

## Fase PD — Build pipeline

| # | Issue | Cambio | Archivo |
|---|-------|--------|---------|
| D1 | M2 | Debuggear Vite: por qué emite `type="module"` con `format:'iife'` | `vite.config.ts` |
| D2 | L1 | Spinner CSS en template `index.html` | `react/index.html` |
| D3 | L3 | Test que verifique `moveExternalScriptsToBodyEnd` sin `type="module"` | `webviewHtmlTransforms.ts` |

---

## Archivos modificados (14 total)

| Archivo | Fase(s) |
|---------|---------|
| `ui/provider/MiniInputViewProvider.ts` | PA |
| `ui/provider/webviewHtmlTransforms.ts` | PA, PD |
| `ui/provider/webviewHtml.ts` | PA |
| `ui/webview/react/hooks/ghostPromptUiState.ts` | PA, PC |
| `ui/webview/react/main.tsx` | PB |
| `ui/webview/react/components/ErrorBoundary.tsx` | PB |
| `ui/webview/react/hooks/handleGhostPromptInboundMessage.ts` | PB, PC |
| `ui/webview/react/hooks/useGhostPromptHandlers.ts` | PB |
| `ui/webview/react/utils/hostQuery.ts` | PC |
| `ui/webview/react/hooks/useGhostPromptEffects.ts` | PC |
| `vite.config.ts` | PD |
| `ui/webview/react/index.html` | PD |

---

## Verificación por fase

Cada fase ejecuta en orden:
1. `npm run lint -- --fix` (auto-fix import order)
2. `npm run typecheck` (TypeScript)
3. `npm run compile` (compilación host)
4. `npm run build:webview` (bundle webview)
5. `npm run test` (65 test files, ~310 tests)

PD requiere además inspección manual de `dist/react/index.html`.

---

## Registro de ejecución

| Fecha | Fase | Resultado |
|-------|------|-----------|
| 2026-05-18 | PA | A1–A4 completados. 315 tests OK. |
| 2026-05-18 | PB | B1–B3 completados. Fallback visible, reload real, feedback en catch. 315 tests OK. |
| 2026-05-18 | PC | C1–C3 completados. hostQuery timeout, isConfigLoaded skeleton, pre-mount buffer. 315 tests OK. |
| 2026-05-18 | PD | D1–D3 completados. Build limpio, spinner animado, test de moveScripts. 316 tests OK. |
