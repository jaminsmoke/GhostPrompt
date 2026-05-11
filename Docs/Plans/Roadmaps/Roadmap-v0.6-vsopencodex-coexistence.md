# Roadmap v0.6.0 — Coexistencia con VSOpenCodeX y destino del Send

> **Versión objetivo:** **0.6.0** cuando se cierren las fases no bloqueadas **más** la fase bloqueante en cuanto VSOpenCodeX publique el contrato de envío definitivo.  
> **Origen:** evitar dos `opencode serve` en paralelo; ofrecer experiencia unificada cuando el usuario instala VSOpenCodeX manteniendo GhostPrompt standalone útil sin ella.

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
| Comando estable para **Send** desde GhostPrompt → VSOpenCodeX (nombre, argumentos, comportamiento vista cerrada / errores) | VSOpenCodeX + entrada en CHANGELOG minor si cambia el shape |

Tras ese contrato, en GhostPrompt se completa **Fase C** below.

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

## Fase C — Destino Send: Copilot Chat vs VSOpenCodeX (**blocked hasta contrato**)

### Objetivo

Setting **host-centric** (`ghostPrompt.*`) separado del motor de completions (los `enabledCompletionSources` / modelo actual pueden no cambiar en el webview):

- Ejemplo provisional: **`ghostPrompt.sendTarget`**: `"copilotChat"` | `"vsOpenCodeX"`.

Implementar rutas Copilot igual que hoy; ruta VSOpenCodeX mediante **comando publicado por VSOpenCodeX** cuando esté disponible (firma pendiente).

### Bloqueantes

- Comando estable + tipos desde VSOpenCodeX (este repo sólo debe implementar después de recibir changelog / snippet final).
- Comportamiento si extensión no instalada / comando falla: definir UX (mensaje guiado vs fallback silencioso a Copilot) en el mismo hito.

### Pasos derivados (después del desbloqueo)

1. Añadir `contributes.configuration` + lectura donde hoy resuelve el envío (`ChatBridge` / handler `send`).
2. `executeCommand(...)` según especificación VSOpenCodeX.
3. Tests con mocks para ambos destinos donde sea viable.

### Criterio de hecho

- Send llega correctamente en ambos modos configurados tras especificación cerrada.

### Estado

- [ ] **Blocked** — contrato Send desde VSOpenCodeX
- [ ] Implementación cerrada *(tras desbloqueo)*

---

## Fase D — Liberación **0.6.0**

### Checklist

- [ ] Fases **A**, **B** y **C** cerradas según definición arriba.
- [ ] `package.json`, `CHANGELOG`, README mencionan coexistencia VSOpenCodeX y nueva setting de send si existe.
- [ ] Re-ejecutar QA manual coexistencia doc + caso send con cada destino.
- Integración opcional OpenCode CI / releasing doc según aplique antes del bump.

### Estado

- [ ] Cerrado

---

## Bitácora global

| Fecha | Fase | Nota |
|-------|------|------|
| 2026-05-10 | — | Roadmap creado: coexistencia con VSOpenCodeX; Send bloqueante hasta contrato en VSOpenCodeX; target versión **0.6.0**. |
| 2026-05-10 | Fases A+B | Puente `vsOpenCodeXBridge`, settings `preferVsOpenCodeXOpenCode` / `vsOpenCodeXProbeDelayMs`, README + ARCHITECTURE; tests `vsOpenCodeXBridge.test.ts`. |

---

## Referencias

- [`Docs/Integrations/GhostPrompt-OpenCode-coexistence.md`](../../Integrations/GhostPrompt-OpenCode-coexistence.md)
- [`Docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) § OpenCode / host
- [`Docs/Plans/Releasing-opencode-integration.md`](../Releasing-opencode-integration.md) (opcional QA integración CLI)
