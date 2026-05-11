# GhostPrompt: motor vs destino vs superficie — matriz con VSOpenCodeX

Documento de **diseño compartido** entre **VSOpenCodeX** y **GhostPrompt**. Actualizar ambos repos cuando cambie el contrato.

**Relacionado:** [GhostPrompt-OpenCode-coexistence.md](./GhostPrompt-OpenCode-coexistence.md) (puerto, `getOpenCodeConnection`, anti duplicado `opencode serve`). Implementación y fases en GhostPrompt: [Roadmap v0.6](../Plans/Roadmaps/Roadmap-v0.6-vsopencodex-coexistence.md) (**Fase C** alineada con destino VSX = superficie VSX; Send lo gestiona VSX).

---

## Tres ejes (GhostPrompt debe distinguirlos en configuración y código)

| Eje | Significado | Ejemplos |
|-----|-------------|----------|
| **Motor de suggestions** | De dónde sale el texto sugerido (streaming / completion). | Copilot LM (`vscode.lm`), OpenCode (SDK contra `opencode serve`). |
| **Destino (Send / agente)** | A qué servicio se envía el **prompt final** para que trabaje el agente (no es solo “copiar UI”). | GitHub Copilot Chat; **VSOpenCodeX** (tubería propia → OpenCode según configuración VSX). |
| **Superficie de visualización** | Dónde el usuario ve el borrador y las suggestions **inline**. | Webview + chat inline de GhostPrompt (modo clásico); **solo chat / panel de VSOpenCodeX** cuando el destino es VSOpenCodeX. |

Motivo del tercer eje: en el producto GhostPrompt estándar, el inline no puede apoyarse en el UI propietario de Copilot Chat por restricciones; con VSOpenCodeX **sí** existe una superficie explícita (**nuestro** webview de chat). Por tanto:

- **Destino VSOpenCodeX** → GhostPrompt debe **anular / deshabilitar** su **chat inline** y **no usar su webview como superficie única del hilo** cuando el producto define contexto unificado VSX; las suggestions deben enlazarse con VSOpenCodeX (contrato técnico por fases en [Roadmap-GhostPrompt-integration.md](../Roadmaps/Roadmap-GhostPrompt-integration.md)).

El **motor** sigue siendo elegible en GhostPrompt **en los cuatro escenarios**; lo que cambia es el **destino** y la **superficie**.

---

## Matriz de situaciones (comportamiento esperado)

### Situación 1 — Motor Copilot · Destino Copilot

| Aspecto | Comportamiento |
|---------|----------------|
| Rol | GhostPrompt **standalone** al servicio de Copilot. |
| Suggestions | Motor Copilot. |
| Send | Copilot (p. ej. `workbench.action.chat.open` o API equivalente). |
| Superficie | Webview GhostPrompt + inline GhostPrompt (como hoy). |
| VSOpenCodeX | Irrelevante para el flujo; puede estar instalada sin usarse en este modo. |

### Situación 2 — Motor OpenCode · Destino Copilot

| Aspecto | Comportamiento |
|---------|----------------|
| Rol | GhostPrompt **autónomo**: genera suggestions con OpenCode, **envía** el prompt final al agente **Copilot**. |
| Suggestions | OpenCode (cliente SDK). |
| Send | **GitHub Copilot** (quien ejecuta el prompt final). |
| Superficie | Webview GhostPrompt + inline GhostPrompt. |
| OpenCode | Puede ser instancia reutilizada vía VSX (`getOpenCodeConnection`) **solo como motor**, o instancia embebida de GhostPrompt — **decisión de implementación** (una sesión, latencia, política de fallos); documentar en CHANGELOG de GhostPrompt. No implica destino VSOpenCodeX. |

### Situación 3 — Motor Copilot · Destino VSOpenCodeX

| Aspecto | Comportamiento |
|---------|----------------|
| Rol | GhostPrompt trabaja **para VSOpenCodeX** como destino del prompt. |
| Suggestions | Motor Copilot. |
| Send | **Delegado a VSOpenCodeX** (misma tubería que el chat de VSOpenCodeX; contratos por implementar). |
| Superficie | **Solo VSOpenCodeX** — deshabilitar chat inline GhostPrompt según acuerdo de producto. |
| VSOpenCodeX | Superficie autorizada + ejecución del agente/OpenCode según diseño VSX. |

### Situación 4 — Motor OpenCode · Destino VSOpenCodeX

| Aspecto | Comportamiento |
|---------|----------------|
| Rol | GhostPrompt trabaja **para VSOpenCodeX**; suggestions y send alineados con OpenCode vía VSX. |
| Suggestions | OpenCode. |
| Send | **VSOpenCodeX** (sin segundo send paralelo desde GhostPrompt al mismo backend). |
| OpenCode | **Ideal:** una sola instancia — la gestionada por VSX (`getOpenCodeConnection` + cabecera Basic). |
| Superficie | **Solo VSOpenCodeX**; inline GhostPrompt deshabilitado. |

---

## Reglas transversas

1. El **motor** sigue siendo seleccionable en GhostPrompt en los cuatro casos.
2. **Destino VSOpenCodeX** ⇒ **deshabilitar** el chat inline de GhostPrompt (y no usar el webview GhostPrompt como superficie principal del hilo de conversación cuando se acuerde contexto unificado).
3. GhostPrompt debe modelar **motor** y **destino** como dimensiones **independientes** en settings y código (deuda explícita hasta que el producto las separe bien).
4. VSOpenCodeX documenta e implementa cómo recibe el prompt final y cómo integra **visualización de suggestions** desde GhostPrompt (API por fases).

---

## Responsabilidades por repositorio

### GhostPrompt

- Settings explícitos: motor vs destino (nombres finales en `package.json`).
- Lógica condicional: destino VSX ⇒ no `sendToChat` Copilot para ese modo; política de superficie inline/webview como arriba.
- Situación 2: documentar reuso SDK VSX vs servidor propio.
- Tests y QA por fila de la matriz.
- Roadmap GhostPrompt: [**v0.6 Fase C**](../Plans/Roadmaps/Roadmap-v0.6-vsopencodex-coexistence.md) = destino VSX ⇒ superficie VSX (Send y foco en VSX); en la webview GP solo se desactivan **inline + composer/send a Copilot**; **config** sigue activa; contratos VSX para render de suggestions.

### VSOpenCodeX

- Chat como superficie cuando el usuario elija destino VSX vía GhostPrompt.
- Contratos coexistencia OpenCode ya documentados en [GhostPrompt-OpenCode-coexistence.md](./GhostPrompt-OpenCode-coexistence.md).
- Roadmap implementación VSX: [Roadmap-GhostPrompt-integration.md](../Roadmaps/Roadmap-GhostPrompt-integration.md).

---

## Historial

| Fecha | Nota |
|-------|------|
| 2026-05-11 | Primera versión: matriz 1–4, tres ejes, reglas VSX/GP, ajuste Fase C GhostPrompt. |
