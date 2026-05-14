# Roadmap v0.6.0 — Ollama lifecycle management: instalación, inicio y parada de modelos

<!-- markdownlint-disable MD022 MD024 MD060 -->

> Estado general: 🔵 Planificado → ⚪ No iniciado | 🟡 En progreso | 🟢 Completado | 🔴 Bloqueado
>
> Objetivo: Gestionar el ciclo de vida completo del motor Ollama: verificar instalación, listar modelos vía CLI, iniciar/detener modelos con estados visibles en el webview, y limpieza al cerrar VS Code.

---

## Resumen

| Fase | Alcance | Resultado | Estado |
|------|---------|-----------|--------|
| Fase 1 | Crear `ollamaModelManager.ts` — CLI lifecycle vía `exec`/`spawn` | Base técnica: version/list/run/stop | 🟢 Completado |
| Fase 2 | Webview: mensajes ollama-status | Estados visibles en webview | 🟢 Completado |
| Fase 3 | Pipeline + engine: esperar modelo listo | Engine integrado con ModelManager | 🟢 Completado |
| Fase 4 | Limpieza al cerrar VS Code | `ollama stop` en deactivate() | 🟢 Completado |
| Fase 5 | **Flujo completo Ollama: selección de modelo + inicio automático** | Al seleccionar Ollama → elegir modelo → `ollama run` → estado verde | 🟢 Completado |
| Fase 6 | **Centralización de estados: BottomBar derive de providerStatuses vía TanStack Query** | Estado visible sin mensajes ad-hoc. Se eliminó ruta legacy `completionProvider` | 🟢 Completado |

---

## Fase 1 — ollamaModelManager.ts

### Tareas

1. Crear `src/engines/ollama/ollamaModelManager.ts`
   - `checkInstallation()` → `exec("ollama --version")`
   - `listInstalledModels()` → `exec("ollama list")`, parsear stdout
   - `startModel(modelId)` → `spawn("ollama run", [modelId])` con detección de ready en stdout
   - `stopModel(modelId?)` → `exec("ollama stop " + modelId)`
   - `stopAll()` → `exec("ollama stop")`

### ✅ Estado: Completado

---

## Fase 2 — Webview: estados ollama-status

### Tareas

1. Schemas Zod para `ollama-status`
2. Tipos en webview `types.ts`
3. Handler en `useGhostPrompt.ts`
4. Estados de loading en `loading.ts`

### ✅ Estado: Completado

---

## Fase 3 — Pipeline + Engine

### Tareas

1. `ollamaLmEngine.ts`: verificar modelo listo antes de generar
2. `suggestPipeline.ts`: mapear fase `ollama-starting-model`

### ✅ Estado: Completado

---

## Fase 4 — Limpieza

### Tareas

1. `extension.ts` → `deactivate()` → `ollamaModelManager.stopAll()`
2. `inboundHandlers.ts`: stop al cambiar de motor

### ✅ Estado: Completado

---

## Fase 5 — Flujo completo: selección de modelo + inicio automático (PENDIENTE)

### Problema actual

Actualmente `ollamaStatus.check()` retorna `running` si hay modelos instalados, incluso si ningún modelo está cargado en memoria. El chip label muestra el icono verde siempre. No hay flujo de "seleccionar modelo → iniciar modelo → modelo listo".

### Tareas

#### 5.1 — ollamaStatus.ts: detectar modelo activo vía `ollama ps`

```ts
// check() actualizado
async check(): Promise<ProviderStateRecord> {
  // 1. Verificar instalación
  let version: string;
  try {
    version = await execAsync("ollama --version", 5000);
  } catch {
    return { status: "unavailable", statusText: "No instalado" };
  }

  // 2. Listar modelos disponibles
  let models: string[] = [];
  try {
    const stdout = await execAsync("ollama list", 10000);
    models = parseModelList(stdout);
  } catch { /* ignorar */ }

  if (models.length === 0) {
    return { status: "stopped", statusText: `Instalado — sin modelos`, actions: [] };
  }

  // 3. Verificar si hay un modelo actualmente cargado
  try {
    const psOut = await execAsync("ollama ps", 5000);
    const activeModel = parseActiveModel(psOut);
    if (activeModel) {
      return {
        status: "running",
        statusText: `${activeModel} activo`,
        actions: ["stop"],
      };
    }
  } catch { /* ignorar */ }

  // Hay modelos instalados pero ninguno cargado
  return {
    status: "stopped",
    statusText: `${models.length} modelo${models.length > 1 ? "s" : ""} disponible${models.length > 1 ? "s" : ""}`,
    actions: [],
  };
}
```

#### 5.2 — ollamaModelManager.ts: agregar `ps()`

```ts
async ps(): Promise<string | null> {
  try {
    const stdout = await this.execAsync("ollama ps", 5000);
    const lines = stdout.split("\n").filter(l => l.trim());
    if (lines.length <= 1) return null;
    return lines[1].trim().split(/\s+/)[0]; // primer modelo en la lista
  } catch {
    return null;
  }
}
```

#### 5.3 — Al seleccionar Ollama como motor, el popup Modelo debe estar activo

En GhostToolbar, cuando `completionProvider === "ollama"` y el status es `stopped`:
- Mostrar mensaje en status line: "Selecciona un modelo de Ollama"
- El chip Modelo debe mostrar los modelos disponibles y resaltar que hay que elegir uno

#### 5.4 — Al seleccionar modelo, iniciarlo automáticamente

Cuando el usuario selecciona un modelo del `<select>` (que activa `updateSetting("selectedModelId", ...)`):

En `inboundHandlers.ts`, cuando se recibe `updateSetting("selectedModelId")`:
```ts
case "updateSetting":
  await applyWebviewUpdateSetting(message);
  await broadcastSettingsToAllViews();
  // Si el motor actual es Ollama, iniciar el modelo seleccionado
  if (getGhostPromptCompletionProvider() === "ollama" && message.key === "selectedModelId") {
    ollamaModelManager.stopAll(); // stop anterior si lo hay
    ollamaModelManager.startModel(message.value).then(() => {
      broadcastUi({ type: "ollama-status", status: "model-ready", model: message.value });
    }).catch(err => {
      broadcastUi({ type: "ollama-status", status: "model-error", message: err.message });
    });
  }
  return;
```

#### 5.5 — Status line durante el proceso

| Momento | Texto en BottomBar |
|---------|-------------------|
| Motor = Ollama, sin modelo | "Selecciona un modelo de Ollama" |
| Modelo seleccionado, iniciando | "Iniciando modelo mistral:latest..." |
| Modelo listo | "Modelo mistral:latest listo" |
| Modelo falló | "Error: {mensaje}" |

### Criterios de aceptación

- `ollama ps` detecta si un modelo está cargado en memoria
- `ollamaStatus.check()` retorna `stopped` aunque haya modelos, si ninguno está cargado
- Al seleccionar Ollama, el chip Modelo permite elegir y muestra prompt
- Al elegir modelo, se ejecuta `ollama run <modelo>` automáticamente
- Status line refleja cada etapa del proceso

---

## Archivos a modificar (Fase 5)

| Archivo | Cambio |
|---------|--------|
| `src/engines/ollama/ollamaModelManager.ts` | + método `ps()` |
| `src/engines/ollama/ollamaStatus.ts` | `check()` actualizado con `ollama ps` |
| `src/api/protocols/inboundHandlers.ts` | En `updateSetting("selectedModelId")`, iniciar modelo Ollama |
| `src/ui/webview/react/components/GhostToolbar.tsx` | Popup Modelo: si Ollama stopped, mostrar "Selecciona modelo" |
| `src/ui/webview/react/hooks/useGhostPrompt.ts` | Handler para mensajes new ollama-status cuando se inicia modelo |

---

## Hitos clave

| Hito | Objetivo | Criterio de éxito | Estado |
|------|----------|-------------------|--------|
| Hito 1 | OllamaModelManager funcional | CLI version/list/run/stop | 🟢 Completado |
| Hito 2 | Webview con estados Ollama | Mensajes ollama-status visibles | 🟢 Completado |
| Hito 3 | Estados de loading Ollama | "Iniciando modelo..." en status line | 🟢 Completado |
| Hito 4 | Limpieza al cerrar | `ollama stop` en deactivate() | 🟢 Completado |
| Hito 5 | **Flujo completo Ollama** | Seleccionar modelo → `ollama run` → estado verde | 🟢 Completado |
| Hito 6 | **Estado centralizado** | BottomBar deriva de TanStack Query, no de mensajes sueltos | 🟢 Completado |
