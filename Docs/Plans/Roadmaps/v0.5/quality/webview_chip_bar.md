# Roadmap v0.5.6 — Barra de chips estilo VS Code + Refinamiento webview

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: Reemplazar el toolbar plano del webview por una barra de chips estilo menú VS Code, donde cada chip muestra el valor activo y abre un popup contextual. Esto libera espacio vertical, reduce ruido visual y unifica la experiencia con el ecosistema VS Code.
>
> Esta versión continúa el trabajo de la v0.5.5 (migración React + Vite + Tailwind).

---

## Resumen

| Fase | Alcance | Resultado | Estado |
|------|---------|-----------|--------|
| Fase 1 | Crear componente `ToolbarChip` reutilizable | Chip + popup con click-outside, Escape, posicionamiento | 🟢 Completado |
| Fase 2 | Reescribir `GhostToolbar` con chips | Barra: Motor, Destino, Modelo, Composición, ⚙ | 🟢 Completado |
| Fase 3 | Actualizar tests de paridad | Tests reflejan nueva estructura de IDs | 🟢 Completado |
| Fase 4 | Build + validación final | `npm run validate` y `npm run test` pasan | 🟢 Completado |

---

## Fase 1 — Componente ToolbarChip

### Objetivo

Crear un componente reutilizable que encapsule el patrón "botón chip → popup flotante".

### Tareas

1. Crear `src/ui/webview/react/components/ToolbarChip.tsx`
   - Botón con label + flecha ▾ (gira al abrir)
   - Popup posicionado absolutamente debajo
   - Cerrar al hacer click fuera (con `setTimeout(0)` para evitar auto-cierre)
   - Cerrar con tecla Escape
   - Props: `label`, `isOpen`, `onToggle`, `onClose`, `children`, `id` (opcional), `disabled`

2. El chip debe aceptar cualquier contenido como children (menú de items, toggles, selects)

### Criterios de aceptación

- ToolbarChip renderiza el botón con label y flecha
- Al hacer click se abre el popup con los children
- Click fuera del popup lo cierra
- Escape lo cierra
- Múltiples chips pueden coexistir en el mismo contenedor

---

## Fase 2 — GhostToolbar con chips

### Objetivo

Reescribir `GhostToolbar.tsx` para usar 5 chips: Motor, Destino, Modelo, Composición, ⚙.

### Tareas

1. **Chip Motor** — menú con 3 opciones: Copilot LM, OpenCode, Ollama
   - Muestra checkmark ✓ en el activo
   - Label del chip: nombre del motor activo

2. **Chip Destino** — menú con 2 opciones: Copilot Chat, VSOpenCodeX
   - Solo visible si la extensión VSOpenCodeX está instalada
   - Label: destino activo

3. **Chip Modelo** — popup con:
   - Toggles: No premium / Cualquiera
   - Select de modelos
   - Label del modelo activo
   - Label del chip: nombre del modelo o "Auto"

4. **Chip Composición** — popup con 3 grupos de toggles:
   - Estilo: Breve / Normal / Extenso
   - Contexto: Básico / Proyecto / Off
   - Idioma: Auto / ES / EN
   - Label del chip: combinación de valores activos (ej. "Normal · Básico · Auto")

5. **Chip ⚙ (engranaje)** — popup con:
   - Debug: on/off
   - Espacio reservado para futuros settings

6. Helpers internos:
   - `MenuItem` — item de menú con hover y checkmark
   - `ToggleGroup` — grupo de botones toggle con label

### Criterios de aceptación

- Todos los controles funcionan igual que antes (misma lógica de negocio)
- Chips se adaptan al ancho disponible (flex-wrap)
- En sidebar compacto los chips se ven bien
- Popups se cierran al seleccionar una opción

---

## Fase 3 — Tests

### Tareas

1. Actualizar `tests/webviewToolbarParity.test.ts`:
   - Cambiar checks de IDs de selects/buttons planos a IDs de chips
   - Verificar que los 6 `data-key` sigan presentes en el source
   - Verificar IDs: `motor-chip`, `destino-chip`, `modelo-chip`, `composicion-chip`, `gear-chip`

### Criterios de aceptación

- Tests de paridad pasan
- Tests del webview pasan
- Tests generales pasan (219 tests)

---

## Fase 4 — Build + validación

### Tareas

1. Ejecutar `npm run build:webview:react` (Vite)
2. Ejecutar `npm run compile` (TypeScript host)
3. Ejecutar `npm run typecheck:webview` (TypeScript webview)
4. Ejecutar `npm run test` (vitest)
5. Ejecutar `npm run validate` (lint + circular + compile + build + verify)

### Criterios de aceptación

- Vite build exitoso
- Sin errores de TypeScript
- 219 tests pasan
- Bundle verification OK

---

## Hitos clave

| Hito | Objetivo | Criterio de éxito | Estado |
|------|----------|-------------------|--------|
| Hito 1 | ToolbarChip funcional | Chip + popup creado y probado en aislamiento | 🟢 Completado |
| Hito 2 | GhostToolbar reescrito | Barra completa con 5 chips funcionando | 🟢 Completado |
| Hito 3 | Tests actualizados | Tests de paridad reflejan nueva estructura | 🟢 Completado |
| Hito 4 | Build + validación | `npm run validate` y `npm run test` pasan | 🟢 Completado |
