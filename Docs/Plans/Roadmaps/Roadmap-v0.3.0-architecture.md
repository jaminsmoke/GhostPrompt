# Roadmap v0.3.0 — Reestructuración `src` y base para proveedores de completion

> **Rama de trabajo:** `feature/v0.3-architecture-restructure`  
> **Versión objetivo de release:** **0.3.0** (publicar al cerrar las fases acordadas de refactor + tests verdes; no antes solo por mover carpetas).  
> **Relacionado:** plan complementario de proveedor opcional OpenCode → [`Roadmap-v0.3-opencode-integration.md`](./Roadmap-v0.3-opencode-integration.md).

## Objetivo

1. **Organizar el código** en capas claras (sesión, completion, webview host, governor, bridge) para que **GhostPrompt** pueda soportar más de un origen de texto (hoy: Copilot `vscode.lm`) sin un archivo monolítico.
2. **Renombrar y dividir** solo donde aporte claridad; mantener comportamiento observable salvo bugs encontrados en el refactor.
3. **Preparar** una interfaz estable tipo `CompletionProvider` antes de implementar OpenCode u otros backends.

## Estado actual (tras Fase A — árbol físico)

- `src/completion/CopilotCompletion.ts`: LM selection, `sendRequest`, instrucción, normalización, idioma, listado de modelos (Fase B lo partirá).
- `src/session/GhostPromptSessionStore.ts`: estado compartido Sidebar + Panel.
- `src/host/MiniInputViewProvider.ts`: webview + flujo suggest/patch/broadcast.
- `src/governor/SuggestionRequestGovernor.ts`, `src/bridge/ChatBridge.ts`, `src/log/*`, `src/debug/SuggestionDebug.ts`.
- Entrada de extensión: `src/extension/extension.ts` → `package.json` `main`: `./out/extension/extension.js`.

## Objetivo de estructura de carpetas (orientativo)

Los nombres exactos se fijan en la primera PR de **Fase A**; la tabla sirve como contrato mental.

| Carpeta | Responsabilidad |
|--------|------------------|
| `src/extension/` | `activate`, registro de comandos/views si conviene agrupar |
| `src/session/` | `GhostPromptSessionStore`, tipos de estado de sesión |
| `src/completion/` | Contratos comunes, normalización compartida, **providers** (`copilotLm`, futuro `opencode`) |
| `src/webview/` o `src/host/` | `MiniInputViewProvider` (nombre revisable) |
| `src/governor/` | `SuggestionRequestGovernor` |
| `src/bridge/` | envío al chat Copilot (`ChatBridge`) |
| `src/debug/` o mantener en raíz | `SuggestionDebug`, logs relacionados |

No es obligatorio crear **todas** las carpetas en el primer commit; sí evitar ciclos de imports y mantener tests importando desde rutas estables.

## Fases ejecutables

### Fase A — Reubicación mecánica (sin cambiar lógica)

- [x] Crear estructura de carpetas mínima acordada (`extension/`, `session/`, `completion/`, `host/`, `governor/`, `bridge/`, `debug/`, `log/`).
- [x] Mover archivos con actualización de imports y paths en tests; `ARCHITECTURE.md` / `PhysicalStructure.md` alineados.
- [x] `npm run check` verde.
- **Criterio:** diff principalmente “rename/move”; mismo comportamiento en ejecución manual ligera.

### Fase B — Separación de concerns en completion

- [ ] Extraer de `CopilotCompletion.ts` bloques bien delimitados, por ejemplo:
  - selección de modelo / política (`selectChatModels`, `selectModelByPolicy`, `listSuggestionModels`);
  - construcción de instrucción (`buildCompletionInstruction`, `suggestionStyleDirective`);
  - normalización (`normalizeSuggestion` y helpers privados);
  - `requestCompletion` como orquestador fino que llama a las piezas anteriores.
- [ ] Introducir interfaz interna `CompletionProvider` (o nombre equivalente) con implementación **solo Copilot LM** que delegue en el código existente.
- [ ] `MiniInputViewProvider` / capa que llame al proveedor sin conocer detalles de `vscode.lm` más allá del adaptador.
- [ ] `npm run check` verde.
- **Criterio:** tests existentes siguen pasando; nuevos tests solo si un extract facilita cobertura.

### Fase C — Pulido y release 0.3.0

- [ ] Renombrar archivos exportados si quedó nombre engañoso (ej. evitar que “CopilotCompletion” sea el namespace de todo el dominio).
- [ ] Actualizar `ARCHITECTURE.md` / README “Developer notes” con el diagrama de carpetas.
- [ ] Bump de versión a **0.3.0** en `package.json`, `CHANGELOG`, README badges — **en la PR que cierre esta fase**, no antes sin consenso.
- [ ] Tag git `v0.3.0` opcional según flujo del mantenedor.

## Fuera de alcance de v0.3.0 arquitectura

- Implementación completa del proveedor OpenCode (ver roadmap dedicado).
- Cambios de protocolo webview salvo los mínimos que imponga el refactor.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Import cycles | Capas: `completion/types` sin depender de webview; providers dependen de VS Code API solo en adaptador Copilot. |
| VSIX más grande por reorganización | Solo imports; sin nuevas deps en Fase A/B salvo decisión explícita. |
| Regresiones sutiles | PRs pequeños por fase; smoke manual checklist del roadmap v0.2.4b tras Fase B. |

## Definición de hecho (v0.3.0)

- Estructura `src` alineada con este documento (salvo desviaciones documentadas al final del archivo).
- Un único punto de entrada conceptual para “pedir completion” hacia el futuro segundo proveedor.
- `npm run check` verde.
- Versión **0.3.0** y entradas de changelog/README coherentes con el refactor.

---

## Bitácora de desviaciones

*(Rellenar si la implementación final difiere del layout propuesto; una línea por decisión.)*

- **Fase A:** Carpeta `src/host/` para `MiniInputViewProvider` (el roadmap alternaba `webview/`; “host” evita confundir con assets `webview/` del renderer). Logs en `src/log/` en lugar de mezclarlos con `debug/`. 
