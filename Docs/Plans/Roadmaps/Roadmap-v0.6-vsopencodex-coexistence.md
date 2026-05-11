# Roadmap v0.6.0 — Coexistencia VSOpenCodeX: motor, destino y superficie

> **Versión objetivo:** **0.6.0** cuando se cierren las fases no bloqueadas **más** la fase bloqueante en cuanto VSOpenCodeX publique los **contratos de superficie** (suggestions en el chat VSX + señales de estado).  
> **Origen:** evitar dos `opencode serve` en paralelo; modelo **motor vs destino vs superficie** — ver [`GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md).

**Especificación técnica de conexión (ya disponible):** [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](../../Integrations/GhostPrompt-OpenCode-coexistence.md)

**Política de producto:**

- Si **VSOpenCodeX no está instalada**, GhostPrompt **sigue igual** que hoy (suggestions Copilot/OpenCode con servidor embebido cuando corresponda).
- Si está instalada y el servidor está gestionado por VSOpenCodeX, GhostPrompt debe **preferir reusar** conexión vía comandos antes de lanzar otro proceso en el mismo puerto.
- Comunicación al usuario (README / onboarding breve): la experiencia **más integrada** (sin duplicar webviews donde VSOpenCodeX ya integra UI) es usando ambas extensiones como lo documentará VSOpenCodeX — **opcional**, no obligatorio.

**Metodología:** fases ejecutables por orden salvo donde se marca **blocked** pendiente del otro repositorio.

---

## Alcance fuera de este roadmap (delegado VSOpenCodeX)

| Entregable | Dónde |
|------------|--------|
| **Superficie de chat VSX** donde se renderizan las suggestions de GhostPrompt y donde el usuario envía el prompt (**Send** lo resuelve VSX, no GhostPrompt). | VSOpenCodeX — API por fases (eventos, comandos o canal acordado). |
| Contrato para **inyectar / actualizar** texto sugerido en esa superficie según motor y settings elegidos en GhostPrompt. | VSOpenCodeX + CHANGELOG minor si cambia el shape |

GhostPrompt **no** implementa un segundo “Send a VSX” desde su webview cuando el destino es VSOpenCodeX: el foco y el envío viven en el chat VSX; GhostPrompt aplica **gating de UI** (desactivar inline + send a Copilot) y participa como **motor + configuración** visibles en la tira de opciones.

Tras esos contratos, en GhostPrompt se completa **Fase C** below.

---

## Fase A — Runtime OpenCode: retraso + detección + reuso

### Objetivo

Implementar en GhostPrompt el flujo descrito en el doc de coexistencia: espera anti-carrera opcional, comprobar si VSOpenCodeX está instalada/activable, llamar `vsopencodex.getOpenCodeConnection`, y crear cliente SDK **sin** arrancar `opencode serve` propio cuando `ok === true`.

### Pasos derivados

1. Ajustar `OpenCodeRuntime` / capa equivalente para:
   - no arrancar servidor de inmediato de forma incompatible con §2–§3 del doc de coexistencia;
   - después del delay configurado, `getExtension(...)`, `executeCommand("vsopencodex.getOpenCodeConnection")`, crear cliente con `baseUrl` + `Authorization` cuando aplique.
2. Si `ok === false` y política configurada coincide con [`GhostPrompt-OpenCode-coexistence.md`](../../Integrations/GhostPrompt-OpenCode-coexistence.md): no asumir puerto ocupado ajeno como válido; fallback al **servidor embebido** actual (usuario sin servidor VSOpenCodeX levantado todavía).
3. Setting(s) ejemplo:  
   `ghostPrompt.preferVsOpenCodeXOpenCode`: `boolean` default `true` (nombre final a acordar con `package.json`).  
   `ghostPrompt.vsOpenCodeXProbeDelayMs`: rango recomendado 500–2000 ms.
4. Seguridad: no loguear `authorizationHeader` (ver doc coexistencia).

### Criterio de hecho

- Tests con mock de `vscode.commands.executeCommand` y `vscode.extensions.getExtension`; `npm run check` verde.
- QA manual siguiendo §5 del doc coexistencia cuando sea posible (matriz sólo GP / ambas extensiones).

### Estado

- [x] Implementación cerrada

---

## Fase B — Documentación UX y coexistencia visible

### Objetivo

Usuarios entienden que VSOpenCodeX es opcional pero recomendable para flujo integrado; sin bloquear a quien sólo usa GhostPrompt.

### Pasos derivados

1. README: párrafo + enlace al doc `Integrations/GhostPrompt-OpenCode-coexistence.md`; aclaración motor actual vs coexistencia puerto/conexión.
2. Opcional en `CHANGELOG` al acercarse a **0.6.0**.
3. `ARCHITECTURE.md` §OpenCode —nota corta sobre “delegación opcional a VSOpenCodeX”.

### Criterio de hecho

- Docs revisados; sin contradecir el comportamiento Fase A.

### Estado

- [x] Implementación cerrada

---

## Fase C — Destino agente + superficie: Copilot vs VSOpenCodeX (**blocked hasta contratos VSX**)

### Objetivo

Modelar **destino** (agente que ejecuta el prompt final) **independiente** del **motor** de suggestions — matriz [`GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md).

- Setting **host-centric** (nombre provisional): **`ghostPrompt.agentDestination`**: `"copilotChat"` | `"vsOpenCodeX"` (o equivalente acordado en `package.json`).
- **Destino Copilot Chat:** comportamiento actual — webview con **inline + composer + Send a Copilot**; motor Copilot u OpenCode según ajustes existentes.
- **Destino VSOpenCodeX:**
  - **Deshabilitar** en la webview GhostPrompt: **chat inline** (área composer / ghost que duplica el hilo) y **Send** (y cualquier camino a Copilot Chat desde esa vista).
  - **Mantener activos** los controles de **configuración** (chips, motor, política, estilo, etc.) — la tira de opciones sigue siendo el panel de control del motor elegido.
  - **Superficie del hilo:** solo VSOpenCodeX; el **Send** y el foco del chat los gestiona VSX. GhostPrompt se limita a **honrar las configuraciones elegidas** y a **alimentar / sincronizar** las suggestions en el chat VSX según el contrato que publique VSOpenCodeX (no un segundo Send paralelo desde GhostPrompt).

### Bloqueantes

- Contrato VSOpenCodeX: cómo VSX **recibe y muestra** suggestions (y deltas) desde GhostPrompt; manejo de errores / vista no lista.
- Si destino VSX pero extensión ausente o contrato falla: UX (fallback a Copilot destino, aviso, o bloqueo guiado) — definir en el mismo hito.

### Pasos derivados (después del desbloqueo)

1. `contributes.configuration` para **destino** + lectura en host; propagar a webview lo mínimo para **ocultar o deshabilitar** solo composer/inline/send (CSS + estado o mensaje breve en el área del chat desactivado).
2. Integración con API VSX acordada (sin duplicar lógica de envío del prompt).
3. Tests: destino Copilot sin regresión; destino VSX con mocks de comandos/canal VSX donde aplique.

### Criterio de hecho

- Matriz 1–4 del doc motor/destino cubierta en QA manual; con destino VSX no hay Send a Copilot desde la webview GhostPrompt; configuración sigue usable.

### Estado

- [ ] **Blocked** — contratos superficie / suggestions en VSOpenCodeX
- [ ] Implementación cerrada *(tras desbloqueo)*

---

## Fase D — Liberación **0.6.0**

### Checklist

- [ ] Fases **A**, **B** y **C** cerradas según definición arriba.
- [ ] `package.json`, `CHANGELOG`, README mencionan coexistencia VSOpenCodeX y setting **destino agente** si existe.
- [ ] Re-ejecutar QA manual coexistencia doc + matriz motor/destino (incl. destino VSX: sin Send Copilot desde webview GP).
- Integración opcional OpenCode CI / releasing doc según aplique antes del bump.

### Estado

- [ ] Cerrado

---

## Bitácora global

| Fecha | Fase | Nota |
|-------|------|------|
| 2026-05-10 | — | Roadmap creado: coexistencia con VSOpenCodeX; Send bloqueante hasta contrato en VSOpenCodeX; target versión **0.6.0**. |
| 2026-05-10 | Fases A+B | Puente `vsOpenCodeXBridge`, settings `preferVsOpenCodeXOpenCode` / `vsOpenCodeXProbeDelayMs`, README + ARCHITECTURE; tests `vsOpenCodeXBridge.test.ts`. |
| 2026-05-11 | Fase C | Reinterpretación: destino VSX = superficie VSX + Send en VSX; GP desactiva solo inline/composer/send Copilot; config activa; bloqueo = contratos suggestions en VSX (no “Send desde GP”). |

---

## Referencias

- [`Docs/Integrations/GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md)
- [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](../../Integrations/GhostPrompt-OpenCode-coexistence.md)
- [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) § OpenCode / host
- [`Docs/Plans/Releasing-opencode-integration.md`](../Releasing-opencode-integration.md) (opcional QA integración CLI)
