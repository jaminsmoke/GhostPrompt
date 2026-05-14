# Roadmap v0.5.0 — Coexistencia VSOpenCodeX: motor, destino y superficie

> **Versión objetivo:** **0.5.0** (release GhostPrompt para coexistencia VSX, agent destination y fases de este documento). El **cierre E2E** de Fase C sigue ligado a que VSOpenCodeX consuma el contrato de superficie; puede completarse en un **minor** posterior sin impedir el bump **0.5.0** en GhostPrompt.  
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

GhostPrompt puede implementar su parte de **Fase C** (settings, gating, reenvío y comando de suggest) antes de que VSX publique UI definitiva; el **cierre E2E** de Fase C sigue ligado a que VSX consuma ese contrato (ver Fase C — estado).

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
2. Opcional en `CHANGELOG` al acercarse a **0.5.0**.
3. `ARCHITECTURE.md` §OpenCode —nota corta sobre “delegación opcional a VSOpenCodeX”.

### Criterio de hecho

- Docs revisados; sin contradecir el comportamiento Fase A.

### Estado

- [x] Implementación cerrada

---

## Fase C — Destino agente + superficie: Copilot vs VSOpenCodeX

### Objetivo

Modelar **destino** (agente que ejecuta el prompt final) **independiente** del **motor** de suggestions — matriz [`GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md).

- Setting **host-centric**: **`ghostPrompt.agentDestination`**: `"copilotChat"` | `"vsOpenCodeX"` (`package.json`).
- **Destino Copilot Chat:** comportamiento actual — webview con **inline + composer + Send a Copilot**; motor Copilot u OpenCode según ajustes existentes.
- **Destino VSOpenCodeX:**
  - **Deshabilitar** en la webview GhostPrompt: **chat inline** (área composer / ghost que duplica el hilo) y **Send** (y cualquier camino a Copilot Chat desde esa vista).
  - **Mantener activos** los controles de **configuración** (chips, motor, política, estilo, etc.) — la tira de opciones sigue siendo el panel de control del motor elegido.
  - **Superficie del hilo:** solo VSOpenCodeX; el **Send** y el foco del chat los gestiona VSX. GhostPrompt **honra** la configuración y **reenvía** UI de suggestion al comando VSX acordado **`vsopencodex.ghostPromptInlineUi`** (payload sin `broadcast`). VSX invoca **`ghostPrompt.runSuggestPipeline`** con `{ text }` para ejecutar el mismo pipeline de suggestions que la webview (sin `suggest`/`send` desde GP cuando destino VSX).

### Contrato GhostPrompt ↔ VSOpenCodeX (lado GP listo)

| Dirección | Mecanismo |
|-----------|-----------|
| GP → VSX | `vscode.commands.executeCommand("vsopencodex.ghostPromptInlineUi", payload)` para tipos: `loading`, `suggestion-stream`, `suggestion`, `empty`, `error`, `clear`, `languageEffective`. |
| VSX → GP | `vscode.commands.executeCommand("ghostPrompt.runSuggestPipeline", { text })`. |

Errores de `executeCommand` hacia VSX: log opcional en canal debug (`vsopencodex-inline-forward-failed`).

### Pendiente fuera de este repo / cierre E2E

- **VSOpenCodeX** debe implementar el handler de `vsopencodex.ghostPromptInlineUi` y llamar a `ghostPrompt.runSuggestPipeline` cuando corresponda.
- **UX si destino VSX pero VSX no está o falla el comando:** aviso informativo (una vez por sesión de ventana) si la extensión VSX no está cargada + acción «Abrir ajustes». **No** hay fallback automático a `copilotChat` ni toast por fallo de `executeCommand` hacia VSX (solo log debug `vsopencodex-inline-forward-failed`).
- **QA manual** matriz motor/destino con ambas extensiones reales.

### Pasos derivados

1. ~~`contributes.configuration` para **destino** + lectura en host; propagar a webview~~ **Hecho.**
2. ~~Integración con API VSX (comando + reenvío UI; suggest vía comando externo)~~ **Hecho en GP.**
3. ~~Tests: destino Copilot sin regresión; mocks `executeCommand` / handlers~~ **Hecho** (`ghostPromptWebviewInboundHandlers`, `vsOpenCodeXGhostPromptUiBridge`, schemas).

### Criterio de hecho

- Matriz 1–4 del doc motor/destino cubierta en QA manual; con destino VSX no hay Send a Copilot desde la webview GhostPrompt; configuración sigue usable.
- **Parcial:** criterio cumplido en código GhostPrompt; validación E2E y UX de fallo quedan para cerrar el hito con VSX + Fase D.

### Estado

- [x] **Implementación GhostPrompt** (settings, Zod, webview gating, bridge, `ghostPrompt.runSuggestPipeline`, tests).
- [ ] **Criterio de hecho E2E** — QA con VSOpenCodeX que consuma el contrato; opcionalmente UX fallback si VSX ausente.

---

## Fase D — Liberación **0.5.0**

Objetivo: bump de versión y comunicación cuando el producto considere cerrado el hito de release **0.5.0** (incluye verificación cruzada con VSOpenCodeX según checklist).

### Checklist

- [x] Fases **A** y **B** cerradas según definición arriba.
- [ ] Fase **C** cerrada al 100 %: E2E con VSX; opcional: fallback automático u otro tratamiento si **`executeCommand`** hacia VSX falla con extensión instalada.
- [x] `CHANGELOG` y **README**: setting **`ghostPrompt.agentDestination`** + contrato comandos GP↔VSX + coexistencia OpenCode (motor).
- [ ] Re-ejecutar QA manual coexistencia doc + matriz motor/destino (incl. destino VSX: sin Send Copilot desde webview GP).
- [ ] Integración opcional OpenCode CI / releasing doc según aplique antes del bump.

### Estado

- [ ] Cerrado

---

## Bitácora global

| Fecha | Fase | Nota |
|-------|------|------|
| 2026-05-10 | — | Roadmap creado: coexistencia con VSOpenCodeX; Send bloqueante hasta contrato en VSOpenCodeX; target versión extensión **0.5.0** (nombre de documento **v0.5**). |
| 2026-05-10 | Fases A+B | Puente `vsOpenCodeXBridge`, settings `preferVsOpenCodeXOpenCode` / `vsOpenCodeXProbeDelayMs`, README + ARCHITECTURE; tests `vsOpenCodeXBridge.test.ts`. |
| 2026-05-11 | Fase C | Reinterpretación: destino VSX = superficie VSX + Send en VSX; GP desactiva solo inline/composer/send Copilot; config activa; bloqueo = contratos suggestions en VSX (no “Send desde GP”). |
| 2026-05-10 | Fase C (GP) | Implementación en GhostPrompt: `agentDestination`, gating webview, `vsopencodex.ghostPromptInlineUi`, `ghostPrompt.runSuggestPipeline`, tests; cierre E2E pendiente VSX + README/CHANGELOG en Fase D. |
| 2026-05-10 | Fase D (parcial) | README + CHANGELOG; aviso si destino VSX sin extensión cargada; checklist Fase D actualizado. |
| 2026-05-11 | Release | Bump **0.5.0** (`package.json` / VSIX); CHANGELOG consolidado bajo **`[0.5.0]`**. |
| 2026-05-11 | Fase A+ | Reintentos `getOpenCodeConnection` antes del embebido (`vsOpenCodeXConnectionMaxAttempts` / `RetryGapMs`); `cold-start-begin` sólo si spawn embebido; logs `opencodex-attach-begin` / `vsopencodex-probe-start`. Si VSX instalado + prefer on: **no** embebido tras agotar reintentos (`vsopencodex-probe-exhausted-no-embedded`). |

---

## Referencias

- [`Docs/Integrations/GhostPrompt-motor-destino-matrix.md`](../../Integrations/GhostPrompt-motor-destino-matrix.md)
- [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](../../Integrations/GhostPrompt-OpenCode-coexistence.md)
- [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) § OpenCode / host
- [`Docs/Plans/Releasing-opencode-integration.md`](../Releasing-opencode-integration.md) (opcional QA integración CLI)
