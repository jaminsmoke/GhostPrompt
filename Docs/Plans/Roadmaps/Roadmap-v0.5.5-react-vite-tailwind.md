# Roadmap v0.5.5 — Integración React + Vite + Tailwind

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: migrar el webview de GhostPrompt a un stack moderno para UI rica, velocidad de desarrollo y mejor compatibilidad con librerías React-first.
> Esta versión busca integrar cada pieza en fases separadas y documentar resultados y problemas para mejorar futuros releases.

---

## Resumen

Esta roadmap define el plan para convertir el webview de GhostPrompt en una aplicación React construida con Vite y estilizada con Tailwind.

| Fase | Alcance | Resultado | Estado |
|------|---------|-----------|--------|
| Fase 1 | Configurar React + Vite en el webview | Base de build moderna y funcional | 🟢 Completado |
| Fase 2 | Migrar el webview actual por componentes React | UI funcional en React sin romper el flujo | 🟢 Completado |
| Fase 3 | Añadir Tailwind y estilizado utilitario | Webview con UI rica y mantenimiento rápido | 🟢 Completado |
| Fase 4 | Pruebas, documentación y lecciones | Reporte de hallazgos y control de calidad | 🟢 Completado |

Cada fase debe entregarse con un artefacto claro, pruebas ejecutables y una bitácora de problemas/resoluciones.

---

## Fase 1 — Fundamentos del nuevo stack

### Objetivo

Crear el andamiaje del nuevo webview con React y Vite, manteniendo el host actual sin cambios de comportamiento.

### Tareas

1. Configurar el proyecto webview con Vite:
   - `npm install -D vite @vitejs/plugin-react react react-dom @types/react @types/react-dom`
   - Añadir `vite.config.ts` para bundlear el webview.
   - Ajustar `src/ui/webview/tsconfig.json` a `jsx: react-jsx`.
2. Mantener `src/ui/webview/index.html` y reemplazar el script que carga `main.js` por el bundle de Vite.
3. Validar que el build de webview funciona en local y que el paquete VSIX sigue empaquetando el asset correcto.
4. Definir scripts nuevos en `package.json`:
   - `build:webview` para Vite
   - `dev:webview` para desarrollo local si aplica
   - `vscode:prepublish` / `npm run compile` actualizados.

### Criterios de aceptación

- El webview se compila con Vite y genera el bundle React en `src/ui/webview/dist/react`.
- La extensión carga el webview en modo visible sin errores JS críticos.
- Se documenta la configuración en `Docs/Plans/Roadmaps/Roadmap-v0.5.5-react-vite-tailwind.md`.

### Estado actual

- Fase 1 completada: scaffold React/Vite validado con `npm run build:webview:react` y `npm run validate`.
- Fase 2 completada: la UI principal se migró a React y la comunicación host/webview está validada.

### Riesgos

- CSP del webview puede requerir ajustes si se inyecta CSS o scripts de manera distinta.
- El bundle React puede inflar tamaño si no se optimiza.

---

## Fase 2 — Migración gradual del webview actual

### Objetivo

Reescribir el comportamiento del webview actual en React por pasos, sin romper el flujo existente.

### Tareas

1. Identificar componentes naturales:
   - Input composer
   - Ghost suggestion overlay
   - Toolbar y controles de configuración
   - Estado de status / loading
2. Migrar un componente a la vez:
   - Primero, la base del mini-input y la comunicación host/webview.
   - Luego, el ghost text inline.
   - Después, los controles de settings y el select de destino.
3. Mantener el protocolo `postMessage` sin cambios en el host.
4. Añadir tests unitarios para los componentes React o para la lógica de renderizado migrada.

### Criterios de aceptación

- Cada componente migrado debe pasar un `smoke test` dentro de la extensión.
- No se deben introducir regresiones en el envío `send` ni en el flujo de sugerencias.
- Se documenta en la bitácora qué componentes se migraron y qué problemas se encontraron.

### Riesgos

- La lógica de sincronización de draft/ghost puede ser difícil de replicar en React sin perder el timing actual.
- Posibles divergencias en el tamaño y estilo de la UI al pasar de CSS puro a React.

---

## Fase 3 — Integración de Tailwind y UI rica

### Objetivo

Aplicar Tailwind para estilizar el webview y permitir iteraciones rápidas de diseño.

### Tareas

1. Instalar Tailwind con PostCSS:
   - `npm install -D tailwindcss postcss autoprefixer`
   - Crear `tailwind.config.js` y `postcss.config.cjs`.
2. Configurar el CSS global del webview: `src/ui/webview/react/index.css`.
3. Migrar estilos existentes a clases Tailwind donde tenga sentido.
4. Agregar utilidades pequeñas como `clsx` para gestionar clases condicionales:
   - `npm install clsx`
5. Validar el resultado con una UI consistente y responsive dentro del webview.

### Estado actual

- Tailwind y PostCSS se instalaron y configuraron.
- `src/ui/webview/react/index.css` ya incluye los directivas Tailwind.
- Fase 3 completada: la UI React usa utilidades Tailwind y el bundle se compila sin errores.

### Criterios de aceptación

- Tailwind se compila sin errores y el bundle usa estilos correctos.
- La UI del webview mantiene o mejora su aspecto actual.
- Los estilos heredados se revisan y solo se migran los necesarios.

### Riesgos

- Tailwind puede crear un bundle mayor si no se purga correctamente.
- Algunos estilos CSS heredados pueden entrar en conflicto con clases utilitarias.

---

## Fase 4 — Calidad, pruebas y documentación de hallazgos

### Objetivo

Cerrar la integración con pruebas, documentación de problemas y una lista de aprendizajes para futuras versiones.
### Estado actual

- Limpieza del código legacy completada.
- Validación completa `npm run check` pasa con `218` tests.
- Añadido un test React de renderizado para el webview: `tests/webview/App.test.tsx`.
- Tailwind ya está integrado en `src/ui/webview/react/index.css` y la UI React se construye correctamente.
- La fase está cerrada: los hitos 4 y 5 se completaron y el roadmap ahora refleja el estado final.

### Tareas

1. Limpiar el sistema no React obsoleto y consolidar solo los assets, estilos y lógica que la UI React usa hoy.
2. Ejecutar `npm run check` completo y validar que el build React/Webview pase.
3. Escribir pruebas nuevas o adaptar las existentes al componente React.
4. Documentar un resumen al final del roadmap con:
   - lo que funcionó bien
   - problemas encontrados
   - decisiones de diseño importantes
5. Registrar recomendaciones para `0.5.6` o siguientes:
   - librerías React adicionales a evaluar
   - si conviene migrar más componentes del host a React
   - ajustes de bundle / rendimiento

### Criterios de aceptación

- El cambio está documentado en el roadmap con resultados y problemas.
- Hay tests de regresión del flow básico del webview.
- El proyecto permanece estable y el build final es reproducible.

### Riesgos

- Puede quedar trabajo pendiente si no se documenta bien el estado intermedio.
- Sin pruebas nuevas explícitas, la migración puede generar deuda oculta.

---

## Hitos clave

| Hito | Objetivo | Criterio de éxito | Estado |
|------|----------|-------------------|--------|
| Hito 1 | Setup del stack | Vite + React + Tailwind configurados y build local funcionando | 🟢 Completado |
| Hito 2 | Primer componente React | Mini-input migrado y comunicación con host comprobada | 🟢 Completado |
| Hito 3 | Ghost suggestion migrada | Ghost inline renderiza y acepta sugerencias | 🟢 Completado |
| Hito 4 | Tailwind estiliza la UI | Toolbar y settings migrados con Tailwind | 🟢 Completado |
| Hito 5 | Documentación y lecciones | Roadmap actualizada con hallazgos y recomendaciones | 🟢 Completado |

---

## Estructura de seguimiento

Para cada fase, anotar en este documento o en `Docs/Plans/Spikes`:

- Estado actual
- Archivos modificados
- Problemas encontrados
- Soluciones aplicadas
- Tiempo estimado restante

Así podremos optimizar el proceso en futuras versiones.

---

## Decisiones de librerías seleccionadas

- `react`, `react-dom` — UI declarativa y compatibilidad con ecosistema.
- `vite`, `@vitejs/plugin-react` — build rápido y moderno.
- `tailwindcss`, `postcss`, `autoprefixer` — estilo utilitario rápido y mantenible.
- `clsx` — clases condicionales simples.

Opcional a evaluar después de esta fase mayor:

- `@vscode/webview-ui-toolkit` si queremos componentes VS Code nativos.
- `ts-pattern` para lógica de mensajes compleja.
- `@testing-library/dom` si los tests del webview necesitan más precisión.

---

## Post-migration: Component split + Layout VS Code nativo

Durante la fase de cierre se realizaron dos mejoras estructurales importantes:

### 1. División de `App.tsx` (709 → ~30 líneas)

Se extrajeron los siguientes módulos:

| Archivo | Contenido | Líneas |
|---------|-----------|--------|
| `src/ui/webview/react/types.ts` | Todos los tipos compartidos | ~50 |
| `src/ui/webview/react/hooks/useGhostPrompt.ts` | Estado, message listener, handlers | ~200 |
| `src/ui/webview/react/components/GhostToolbar.tsx` | Toolbar de configuración | ~220 |
| `src/ui/webview/react/components/PromptInput.tsx` | Textarea + ghost overlay | ~60 |
| `src/ui/webview/react/components/GhostStatusLine.tsx` | Línea de estado | ~15 |
| `src/ui/webview/react/components/ActionBar.tsx` | Botón enviar + atajos | ~30 |

**Beneficio:** cada archivo tiene una responsabilidad única; `App.tsx` solo orquesta.

### 2. Layout nativo VS Code

Se eliminó el contenedor exterior (card con border/shadow/rounded) que no es idiomático en un webview de VS Code. El layout ahora:

- Usa `var(--vscode-*)` para fondo, texto, inputs, botones y bordes respetando el tema del usuario.
- Elimina `min-h-screen`, `max-w-[1200px]`, `mx-auto` y sombras externas.
- Reduce padding, gaps y border-radii para ocupar el espacio mínimo en sidebar/panel.
- Activa `compactToolbar: true` para la vista sidebar via `_webviewCapabilitiesPayload()`.

---

## Nota final

Esta roadmap es un plan de trabajo para la rama `feature/react-vite-tailwind-webview` y debe ser referenciada en cualquier PR de esta integración. Mediremos cada fase con el criterio de no romper el flujo de GhostPrompt y mantener la extensión funcional durante la migración.
