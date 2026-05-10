# Spike v0.3.2 — Auditoría `src/` e insumos para el siguiente roadmap

**Fecha:** 2026-05-09  
**Tipo:** investigación y lectura de código (sin cambios de implementación en esta pasada).  
**Objetivo:** describir la **situación real** del árbol `src/`, **puntos flacos** y **candidatos de librerías / tooling** para orientar un roadmap posterior (p. ej. 0.3.2 o 0.4.0).

---

## 1. Alcance y método

- **Incluido:** todos los `.ts` bajo `src/`, dependencias runtime en `package.json`, volumen de `webview/main.js`, inventario de tests en `tests/`.
- **No incluido:** ejecución de herramientas pesadas (madge, Sonar) ni mediciones de cobertura por línea.
- **Métrica LOC:** recuento aproximado con PowerShell (`Get-Content | Measure-Object -Line`) sobre el workspace actual.

---

## 2. Métricas rápidas

| Activo | LOC (aprox.) | Nota |
|--------|----------------|------|
| `src/host/MiniInputViewProvider.ts` | ~691 | Mayor archivo del host; orquesta webview, completion, governor, sesión, HTML. |
| `src/completion/providers/opencodeLmCompletion.ts` | ~395 | Sesión OpenCode, SSE paralelo, prompt, streaming. |
| `src/governor/SuggestionRequestGovernor.ts` | ~213+ | Políticas de requests / caché / límites. |
| `src/opencode/OpenCodeRuntime.ts` | ~191+ | Proceso embebido, cliente SDK, ciclo de vida. |
| `webview/main.js` | ~706 | Cliente webview monolítico; sin TypeScript ni bundler. |
| `src/extension/extension.ts` | ~76 | Entrada limpia: registra vistas y comandos. |

El resto de archivos en `src/` ronda entre ~15 y ~130 líneas salvo los citados arriba.

**Dependencias runtime actuales:** `@opencode-ai/sdk`, `zod`.  
**Dev:** TypeScript, ESLint, Vitest, VSCE — sin bundler dedicado al webview.

---

## 3. Organización interna de `src/` — lectura

### 3.1 Fortalezas

| Área | Por qué está bien encaminado |
|------|-------------------------------|
| **`completion/`** | Dominio claro: `types`, `instruction`, `normalize`, catálogos, `providers/` por motor; barrel `completion/index.ts` documentado. |
| **`completion/completionProvider.ts`** | Abstracción `CompletionProvider` + enrutado Copilot vs OpenCode sin ramificar el host por nombre de archivo legacy. |
| **`completionSources.ts`** | Fuente única para multi‑fuente y compatibilidad `completionProvider` legacy. |
| **`session/GhostPromptSessionStore.ts`** | Estado compartido Sidebar + Panel explícito y acotado. |
| **`host/webviewProtocols.ts`** | Contratos Zod separados del gigante del provider (post 0.3.1). |
| **`opencode/`** | Submódulos por responsabilidad (runtime, CLI, SSE, streaming, warm-up). |
| **`extension/extension.ts`** | Delgado; no mezcla lógica de negocio pesada. |

### 3.2 Debilidades estructurales

| Punto | Evidencia | Por qué importa |
|-------|-----------|-----------------|
| **“God object” del host** | `MiniInputViewProvider.ts` concentra protocolo completo webview↔host, `_updateSetting`, `_postSettings`, flujo `suggest`, logs, HTML, broadcast multi‑vista. | Cada feature nueva (UI, idioma, otro mensaje) tiende a **crecer el mismo archivo**; tests requieren mocks amplios. |
| **Host ↔ completion acoplado por imports masivos** | El provider importa muchos símbolos desde `../completion`. | No es incorrecto, pero **oculta fronteras** entre “presentación/host” y “dominio completion”. |
| **Dos velocidades de cliente** | Host en TS + Zod; webview en JS único ~706 líneas. | Los contratos están validados **solo al entrar al host**; el cliente puede desincronizarse si cambia el HTML/JS sin actualizar `webviewProtocols`. |
| **OpenCode como subárbol grande** | Varios archivos con SSE, duplex, streaming fold. | Correcto por dominio, pero **superficie de fallos** (SDK, Node undici, cancelación) concentrada en pocos archivos grandes. |

### 3.3 Limpieza de código (observación cualitativa)

- No se observa proliferación de carpetas vacías ni duplicados obvios de `src` completos.
- Los **comentarios de protocolo** en cabeceras (`MiniInputViewProvider`, `main.js`) ayudan; el riesgo es que **diverjan** de `webviewProtocols` si no se mantienen enlazados en el roadmap de refactors.
- **Estilo:** coherencia alta dentro de cada carpeta; el mayor “olor” es **tamaño de archivo**, no naming inconsistente grave.

---

## 4. Cobertura de tests (inventario)

Hay **19** archivos `tests/*.ts` (Vitest), incluyendo:

- Dominio: `SuggestionRequestGovernor`, `completionSources`, `completionProvider`, normalización, idioma.
- OpenCode: `opencodeLmCompletion`, `opencodeModelCatalog`, `opencodeModelTier`, streaming, CLI, duplex, SSE debug.
- Host / webview: `MiniInputViewProvider`, `webviewProtocols`, `webviewToolbarParity`, `webviewThemeTokens`, `GhostPromptSessionStore`.
- **Integración opcional:** `opencodeSuggestions.integration.test.ts` (condicionada por env).

**Implicación:** la base unitaria es **sólida para CI sin red**; el hueco típico sigue siendo **E2E real webview + VS Code** (caro de automatizar).

---

## 5. Puntos flacos prioritarios (para el siguiente roadmap)

Orden sugerido por **impacto / frecuencia de cambio**:

1. **Reducir o particionar `MiniInputViewProvider`**  
   - Extraer: manejadores por tipo de mensaje (`handleSuggest`, `handleSend`, …), o capa “WebviewMessageRouter”.  
   - Objetivo: cambios de UX sin tocar 600+ líneas.

2. **Alinear webview con contratos**  
   - Opciones: bundler + TS que importe tipos/schemas desde un paquete compartido; o generar tipos desde los mismos Zod (build step).  
   - Objetivo: que un cambio de payload **rompa compile** en el cliente, no solo en el host.

3. **Documentar / aislar frontera OpenCode**  
   - Reglas explícitas: qué es “runtime”, qué es “completion”, qué es “debug SSE”.  
   - Objetivo: bumps de `@opencode-ai/sdk` con superficie de cambio acotada.

4. **Gobernanza opcional de dependencias entre carpetas**  
   - ESLint `import/no-restricted-paths` o similar para impedir `opencode` → `host` inverso si algún día aparece.

---

## 6. Librerías y tooling — candidatos (sin compromiso)

| Candidato | Para qué | Pros | Contras |
|-----------|-----------|------|---------|
| **esbuild / vite (lib)** | Empaquetar `webview/` en TS, imports, quizá `zod` compartido | DX, errores en compile, tree‑shake | Pipeline extra, fuente de VSIX a definir |
| **Tipos compartidos** | `packages/shared` o carpeta `shared/` con schemas Zod | Una fuente de verdad host + webview | Duplicar disciplina de release |
| **mitt / nanostores** | Estado mínimo en webview si crece la UI | Ligero | No sustituye bundler si el archivo sigue siendo enorme |
| **madge** (dev) | Detectar ciclos `src/` | Visibilidad | Solo informa; no “limpia” solo |
| **@vscode/test-electron** | Pruebas más cercanas al webview real | Confianza | Lento, más frágil en CI |

**Fuera de foco típico:** Express, Nest, Next para el núcleo de la extensión (capa distinta).

---

## 7. Cómo enfocar el siguiente roadmap (propuesta)

### Fase propuesta A — **Host ergonomics**

- Particionar `MiniInputViewProvider` sin cambiar comportamiento (refactor mecánico + tests existentes verdes).

### Fase propuesta B — **Cliente webview moderno (opcional)**

- Spike de bundler + un solo módulo TS que reemplace parte de `main.js`; mantener HTML actual.

### Fase propuesta C — **Contratos compartidos**

- Extraer `webviewProtocols` (o subset) a módulo importable por webview build **o** duplicar schemas generados en build.

### Fase propuesta D — **Calidad continua**

- Script `npm run deps:graph` (madge) en CI opcional; límites de tamaño de archivo en ESLint (warn).

---

## 8. Conclusión

El repo está **bien particionado por dominio** (`completion`, `opencode`, `session`, `governor`). El cuello de botella principal para evolución rápida es **concentración de lógica en `MiniInputViewProvider`** y **asimetría TS (host) vs JS monolítico (webview)**. El siguiente roadmap obtiene máximo ROI priorizando **refactor del host** y, en paralelo opcional, **camino hacia webview tipado/embebido**, sin acumular frameworks de servidor irrelevantes.

---

## Referencias en repo

- Roadmap **v0.3.2** derivado de este spike: [`Roadmap-v0.3.2-host-refactor-webview-tooling.md`](../Roadmaps/Roadmap-v0.3.2-host-refactor-webview-tooling.md)
- Roadmap cerrado **v0.3.1**: [`Roadmap-v0.3.1-webview-parity-contracts-ux.md`](../Roadmaps/Roadmap-v0.3.1-webview-parity-contracts-ux.md)
- Contratos: `src/host/webviewProtocols.ts`
- Entrada extensión: `src/extension/extension.ts`
