# Roadmap v0.6.0 — Ollama lifecycle management: instalación, inicio y parada de modelos

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: Gestionar el ciclo de vida completo del motor Ollama: verificar instalación, listar modelos vía CLI, iniciar/detener modelos con estados visibles en el webview, y limpieza al cerrar VS Code.

---

## Resumen

| Fase | Alcance | Resultado | Estado |
|------|---------|-----------|--------|
| Fase 1 | Crear `ollamaModelManager.ts` — CLI lifecycle vía `exec`/`spawn` | Verifica instalación, lista, inicia y detiene modelos | 🟢 Completado |
| Fase 2 | Actualizar webview: nuevos tipos de mensaje y estados | Webview muestra instalación, inicio, fallos del modelo | 🟢 Completado |
| Fase 3 | Pipeline + engine: esperar a modelo listo antes de generar | No genera si el modelo no está listo | 🟢 Completado |
| Fase 4 | Limpieza al cerrar VS Code o cambiar de motor | `ollama stop` en deactivate() | 🟢 Completado |
| Fase 5 | Validación final | Build + 219 tests | 🟢 Completado |

---

## Fase 1 — ollamaModelManager.ts

### Tareas

1. Crear `src/engines/ollama/ollamaModelManager.ts`
   - Clase `OllamaModelManager` con estado interno y events
   - `checkInstallation()` → `exec("ollama --version", { timeout: 5000 })`
   - `listInstalledModels()` → `exec("ollama list", { timeout: 5000 })`, parsear stdout
   - `startModel(modelId)` → `spawn("ollama", ["run", modelId])`, resolver cuando stdout muestra "success"
   - `stopModel(modelId?)` → `exec("ollama stop " + modelId, { timeout: 5000 })`
   - `stopAll()` → `exec("ollama stop", { timeout: 5000 })`

2. Estados internos: `"idle" | "checking" | "ready" | "starting" | "ready-model" | "error"`

3. Guardar referencia al `ChildProcess` de `ollama run` para matarlo en cleanup

### Criterios de aceptación

- `checkInstallation()` retorna `true` si `ollama --version` funciona
- `startModel("mistral:latest")` lanza `ollama run` como proceso hijo
- `stopModel()` ejecuta `ollama stop` y finaliza el proceso hijo si sigue vivo

---

## Fase 2 — Webview: nuevos mensajes ollama-status

### Tareas

1. Agregar a `webviewMessageSchemas.ts`:
   ```ts
   { type: "ollama-status"; status: "checking-install" | "not-installed" | "listing-models" | "starting-model" | "model-ready" | "model-error"; model?: string; message?: string }
   ```

2. Agregar a `types.ts` en `InboundMessage`:
   - `{ type: "ollama-status"; status: string; ... }`

3. Agregar a `useGhostPrompt.ts` handler para mensajes `ollama-status`

4. Agregar estados de loading en `src/core/loading.ts`:
   - `"ollama-checking-install"` → "Verificando instalación de Ollama..."
   - `"ollama-listing-models"` → "Obteniendo modelos locales..."
   - `"ollama-starting-model"` → "Iniciando modelo..."
   - `"ollama-model-ready"` → "Modelo listo"

5. GhostToolbar: cuando motor es Ollama, no auto-seleccionar modelo — mostrar "Selecciona un modelo"

### Criterios de aceptación

- Webview muestra "Verificando instalación..." al seleccionar Ollama
- Webview muestra "Iniciando modelo..." al seleccionar un modelo
- Webview muestra "Error: no instalado" si `ollama --version` falla
- GhostToolbar no auto-selecciona modelo cuando motor es Ollama

---

## Fase 3 — Pipeline + Engine

### Tareas

1. En `ollamaLmEngine.ts`, antes de `generate()`, verificar que el modelo esté listo vía `ollamaModelManager`
2. Si el modelo no está listo, esperar o lanzar error con estado visible
3. En `suggestPipeline.ts`, mapear el nuevo `ollama-starting-model` phase

### Criterios de aceptación

- Si modelo no está iniciado, `requestOllamaCompletion()` espera a que esté listo
- Timeout si el modelo no se inicia en X segundos

---

## Fase 4 — Limpieza

### Tareas

1. En `extension.ts` → `deactivate()`:
   ```ts
   await ollamaModelManager.stopAll();
   ```

2. Al cambiar de motor (Ollama → Copilot/OpenCode) via `updateSetting("completionProvider", ...)`:
   - Host recibe cambio → llama a `ollamaModelManager.stopAll()`

3. Al cambiar de modelo dentro de Ollama:
   - `stopModel(modeloAnterior)` → `startModel(modeloNuevo)`

### Criterios de aceptación

- Al cerrar VS Code, se ejecuta `ollama stop` y se mata el proceso hijo
- Al cambiar de Ollama a Copilot, se detiene el modelo Ollama

---

## Hitos clave

| Hito | Objetivo | Criterio de éxito | Estado |
|------|----------|-------------------|--------|
| Hito 1 | OllamaModelManager funcional | CLI version/list/run/stop funcionan desde Node | 🟢 Completado |
| Hito 2 | Webview con estados Ollama | Mensajes ollama-status visibles en la UI | 🟢 Completado |
| Hito 3 | Estados de loading Ollama | "Iniciando modelo..." aparece en status line | 🟢 Completado |
| Hito 4 | Limpieza al cerrar | `ollama stop` se ejecuta en deactivate() | 🟢 Completado |
